// Moves the e-mail of every existing profile (users/{uid}.email, public) into
// userEmails/{uid} (private) and removes it from the profile. Run AFTER the
// new rules and app are live. Usage: node migrate-emails.cjs [--apply]
// Without --apply it only counts (prints no addresses).
const FT = 'C:/Users/Samuel/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const { requireAuth } = require(FT + '/requireAuth');
const { Client } = require(FT + '/apiv2');
const DB = 'projects/gen-lang-client-0781069215/databases/ai-studio-0d001ce6-fced-485b-83fd-616a8acdf2d6';
const apply = process.argv.includes('--apply');

(async () => {
  const store = require(require('os').homedir() + '/.config/configstore/firebase-tools.json');
  await requireAuth({ user: store.user, tokens: store.tokens });
  const c = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  let token, total = 0, withEmail = 0, done = 0;
  do {
    const r = await c.get(`/${DB}/documents/users`, { queryParams: { pageSize: 300, ...(token ? { pageToken: token } : {}) } });
    for (const d of r.body.documents || []) {
      total++;
      const f = d.fields || {};
      const email = f.email?.stringValue;
      if (!('email' in f)) continue;
      withEmail++;
      if (!apply) continue;
      const uid = d.name.split('/').pop();
      const str = k => f[k]?.stringValue || '';
      const writes = [];
      if (email) {
        writes.push({
          update: {
            name: `${DB}/documents/userEmails/${uid}`,
            fields: {
              email: { stringValue: email.toLowerCase() },
              schoolId: { stringValue: str('schoolId') },
              accountType: { stringValue: str('accountType') },
            },
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }
      // Remove only the e-mail field from the profile.
      writes.push({ update: { name: d.name, fields: {} }, updateMask: { fieldPaths: ['email'] } });
      await c.post(`/${DB}/documents:commit`, { writes });
      done++;
    }
    token = r.body.nextPageToken;
  } while (token);
  console.log(`profiles: ${total}, with e-mail field: ${withEmail}, migrated: ${done}${apply ? '' : ' (dry run)'}`);
  process.exit(0);
})().catch(e => { console.log('ERR', e.status, e.message.slice(0, 300)); process.exit(1); });
