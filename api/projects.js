const GITHUB_USERNAME = "mdjubayermdkawsar-byte";
const GITHUB_REPO = "Severcode-";
const GITHUB_TOKEN = "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";

const headers = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Vercel-Vault-Admin'
};

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // ইন্ডেক্স ডাটা ফেচ করা
    try {
      const dbRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?ref=main&_t=${Date.now()}`, { headers });
      if (dbRes.status === 404) return res.json({ projects: [] });
      const data = await dbRes.json();
      const content = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
      return res.json(JSON.parse(content));
    } catch (e) {
      return res.json({ projects: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, projectName, fileName, fileContent } = req.body;

      // ১. বর্তমান ইন্ডেক্স ডাটা আনা
      let dbData = { projects: [] };
      let sha = null;
      const getIndex = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?ref=main&_t=${Date.now()}`, { headers });
      if (getIndex.ok) {
        const d = await getIndex.json();
        sha = d.sha;
        dbData = JSON.parse(Buffer.from(d.content.replace(/\s/g, ''), 'base64').toString('utf8'));
      }

      // ২. নতুন প্রজেক্ট তৈরি করা
      if (action === 'create_project') {
        if (!dbData.projects.find(p => p.name === projectName)) {
          dbData.projects.push({ name: projectName, files: [] });
        }
      }

      // ৩. ফাইলে কোড সেভ করা
      if (action === 'save_file') {
        const filePath = `vault/${projectName}/${fileName}`;
        
        let fileSha = null;
        const checkF = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=main&_t=${Date.now()}`, { headers });
        if (checkF.ok) {
          const fd = await checkF.json();
          fileSha = fd.sha;
        }

        // গিটহাবে ফাইলটি সেভ বা আপডেট করা
        const saveRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Update ${filePath}`,
            content: Buffer.from(fileContent, 'utf8').toString('base64'),
            sha: fileSha || undefined,
            branch: "main"
          })
        });

        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to save file on GitHub");
        }

        // প্রজেক্টের লিস্টে ফাইলের নাম না থাকলে যুক্ত করা
        let proj = dbData.projects.find(p => p.name === projectName);
        if (!proj) {
          proj = { name: projectName, files: [] };
          dbData.projects.push(proj);
        }
        if (!proj.files.includes(fileName)) {
          proj.files.push(fileName);
        }
      }

      // ৪. ইন্ডেক্স ফাইলটি গিটহাবে সিঙ্ক করা
      await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Sync vault index",
          content: Buffer.from(JSON.stringify(dbData, null, 2), 'utf8').toString('base64'),
          sha: sha || undefined,
          branch: "main"
        })
      });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
