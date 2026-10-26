import assert from 'node:assert/strict';
import test from 'node:test';
import { readBitbucketProfile, readGitHubProfile } from './profile.js';

function response(value: string): unknown {
  return JSON.parse(value);
}

test('reads and validates GitHub commit authors', () => {
  assert.deepEqual(
    readGitHubProfile(
      response(
        '{"author":{"login":"alice","html_url":"https://github.com/alice"}}'
      )
    ),
    { username: 'alice', url: 'https://github.com/alice' }
  );
  assert.equal(
    readGitHubProfile(
      response(
        '{"author":{"login":"alice","html_url":"http://github.com/alice"}}'
      )
    ),
    undefined
  );
  assert.equal(
    readGitHubProfile(
      response(
        '{"author":{"login":"alice","html_url":"https://github.com.evil.test/alice"}}'
      )
    ),
    undefined
  );
});

test('reads Bitbucket profile links and fallback display names', () => {
  assert.deepEqual(
    readBitbucketProfile(
      response(
        '{"author":{"user":{"nickname":"alice","display_name":"Alice Example","links":{"html":{"href":"https://bitbucket.org/alice"}}}}}'
      )
    ),
    { username: 'alice', url: 'https://bitbucket.org/alice' }
  );
  assert.deepEqual(
    readBitbucketProfile(
      response(
        '{"author":{"user":{"display_name":"Alice Example","links":{"html":{"href":"https://bitbucket.org/alice"}}}}}'
      )
    ),
    { username: 'Alice Example', url: 'https://bitbucket.org/alice' }
  );
  assert.equal(
    readBitbucketProfile({
      author: { user: { nickname: 'alice' } },
      links: {
        html: { href: 'https://bitbucket.org/team/repo/commits/abcdef0' },
      },
    }),
    undefined
  );
  assert.equal(readBitbucketProfile(null), undefined);
});
