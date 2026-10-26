import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown } from './render.js';

test('closing references link to issues while retaining the commit reference', () => {
  const markdown = renderMarkdown(
    releases([commit("fix: remove 'brs' (Closes #3554)")]),
    {
      repositoryUrl:
        'https://github.com/material-extensions/vscode-material-icon-theme',
    }
  );
  assert.match(
    markdown,
    /Closes \[#3554\]\(https:\/\/github.com\/material-extensions\/vscode-material-icon-theme\/issues\/3554\)/
  );
  assert.match(markdown, /\/commit\/abcdef0123456789/);
});

const commit = (subject: string, name = 'Alice', body = '') => ({
  hash: 'abcdef0123456789',
  name,
  email: 'private@example.com',
  subject,
  body,
});
const releases = (commits: ReturnType<typeof commit>[]) => [
  {
    tag: 'v2.0.0',
    previousTag: 'v1.0.0',
    commits,
  },
];

test('category entries preserve oldest-to-newest commit order', () => {
  const markdown = renderMarkdown(
    releases([
      commit('fix: oldest'),
      commit('feat: oldest feature'),
      commit('fix: middle'),
      commit('feat: newest feature'),
      commit('fix: newest'),
    ])
  );
  assert.ok(markdown.indexOf('- Oldest (') < markdown.indexOf('- Middle ('));
  assert.ok(markdown.indexOf('- Middle (') < markdown.indexOf('- Newest ('));
  assert.ok(
    markdown.indexOf('- Oldest feature (') <
      markdown.indexOf('- Newest feature (')
  );
});

test('renders compare, scoped Markdown, PR/hash links and sorted unique plain contributors', () => {
  assert.equal(
    renderMarkdown(
      releases([
        commit('fix: repair', 'Zoe'),
        commit('feat(api): **tokens** (#123)'),
        commit('docs: usage'),
        commit('Merge branch', 'Hidden'),
      ]),
      { repositoryUrl: 'https://github.com/example/project.git/' }
    ),
    '# Changelog\n\n## v2.0.0\n\n[compare changes](https://github.com/example/project/compare/v1.0.0...v2.0.0)\n\n' +
      '### Enhancements\n\n- **api:** **Tokens** ([#123](https://github.com/example/project/pull/123))\n\n' +
      '### Fixes\n\n- Repair ([abcdef01](https://github.com/example/project/commit/abcdef0123456789))\n\n' +
      '### Documentation\n\n- Usage ([abcdef01](https://github.com/example/project/commit/abcdef0123456789))\n\n' +
      '### Contributors\n\n- Alice\n- Zoe\n'
  );
});

test('breaking commits appear only in breaking changes and include multiline notes', () => {
  const markdown = renderMarkdown(
    releases([
      commit(
        'feat!: new API',
        'Alice',
        'BREAKING CHANGE: remove `old`\nUse **new** instead.'
      ),
    ])
  );
  assert.match(markdown, /### Breaking Changes/);
  assert.doesNotMatch(markdown, /### Enhancements/);
  assert.match(markdown, /  - Remove `old`\n    Use \*\*new\*\* instead\./);
});

test('capitalizes scoped Markdown and Unicode descriptions and breaking notes without mutating input', () => {
  const input = commit(
    'feat(core): **éclair** API',
    'Alice',
    'BREAKING CHANGE: déjà vu'
  );
  const originalSubject = input.subject;
  const originalBody = input.body;
  const markdown = renderMarkdown(releases([input]));

  assert.match(markdown, /- \*\*core:\*\* \*\*Éclair\*\* API/);
  assert.match(markdown, /  - Déjà vu/);
  assert.equal(input.subject, originalSubject);
  assert.equal(input.body, originalBody);
});

test('renders all group headings in order and unknown/nonconventional under Other Changes', () => {
  const types = [
    'feat',
    'fix',
    'perf',
    'docs',
    'refactor',
    'test',
    'build',
    'ci',
    'chore',
    'revert',
    'custom',
  ];
  const markdown = renderMarkdown(
    releases([
      ...types.map((type) => commit(`${type}: ${type}`)),
      commit('ordinary subject'),
    ]),
    { includeNonConventional: true }
  );
  const headings = [...markdown.matchAll(/^### (.+)$/gm)].map(
    (match) => match[1]
  );
  assert.deepEqual(headings, [
    'Enhancements',
    'Fixes',
    'Performance',
    'Documentation',
    'Refactors',
    'Tests',
    'Build',
    'CI',
    'Chores',
    'Reverts',
    'Other Changes',
    'Contributors',
  ]);
  assert.match(markdown, /- Ordinary subject \(abcdef01\)/);
});

test('escapes raw HTML without losing Markdown and rejects unsafe repository schemes', () => {
  const markdown = renderMarkdown(
    releases([
      commit(
        'fix(ui): **bold** <script>alert(1)</script> (#12)',
        '<img src=x>'
      ),
    ]),
    { repositoryUrl: 'javascript:alert(1)' }
  );
  assert.match(
    markdown,
    /\*\*Bold\*\* &lt;script&gt;alert\(1\)&lt;\/script&gt;/
  );
  assert.match(markdown, /&lt;img src=x&gt;/);
  assert.doesNotMatch(markdown, /<|javascript:|\[Changes\]/);
  assert.match(markdown, /\(#12\)/);
});

test('redacts emails throughout Markdown and rejects email-bearing contributor URLs', () => {
  const privateCommit = {
    ...commit(
      'fix: exposed subject@example.com',
      'Bob <bob@example.com>',
      'BREAKING CHANGE: exposed note@example.net'
    ),
    hash: 'private',
  };
  const linkedCommit = {
    ...commit('feat: linked profile', 'Alice'),
    hash: 'linked',
  };
  const markdown = renderMarkdown(releases([privateCommit, linkedCommit]), {
    repositoryUrl: 'https://github.com/example/project',
    contributors: {
      linked: { username: 'alice', url: 'https://github.com/alice' },
      private: {
        username: 'bob',
        url: 'https://github.com/bob%40example.com',
      },
    },
  });

  assert.match(markdown, /Exposed \[redacted email\]/);
  assert.match(markdown, /Unknown contributor/);
  assert.match(markdown, /\[@alice\]\(https:\/\/github\.com\/alice\)/);
  assert.doesNotMatch(
    markdown,
    /subject@example\.com|bob@example\.com|note@example\.net|%40example\.com/
  );
});

test('handles empty releases, missing previous tag, and encodes compare tag paths', () => {
  assert.equal(renderMarkdown([]), '# Changelog\n');
  assert.equal(
    renderMarkdown([{ tag: 'Unreleased', commits: [] }]),
    '# Changelog\n\n## Unreleased\n'
  );
  const markdown = renderMarkdown(
    [{ tag: 'release/2', previousTag: 'release/1', commits: [] }],
    { repositoryUrl: 'https://github.com/example/repo' }
  );
  assert.match(markdown, /compare\/release%2F1\.\.\.release%2F2/);
});
