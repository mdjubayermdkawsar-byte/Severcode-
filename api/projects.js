module.exports = async (req, res) => {
  const GITHUB_USERNAME = process.env.GH_USERNAME;
  const GITHUB_REPO = process.env.GH_REPO;
  const GITHUB_TOKEN = process.env.GH_TOKEN;

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Vercel-Vault-Admin'
  };

  if (req.method === 'GET') {
    // ডাটাবেস বা ইন্ডেক্স ফাইল আনা
    try {
      const dbRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?ref=main`, { headers });
      if (dbRes.status === 404) return res.json({ projects: [] });
      const data = await dbRes.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      return res.json(JSON.parse(content));
    } catch (e) {
      return res.json({ projects: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, projectName, fileName, fileContent } = req.body;

      // ১. ইন্ডেক্স ডাটা আনা
      let dbData = { projects: [] };
      let sha = null;
      const getIndex = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?ref=main`, { headers });
      if (getIndex.ok) {
        const d = await getIndex.json();
        sha = d.sha;
        dbData = JSON.parse(Buffer.from(d.content, 'base64').toString('utf8'));
      }

      // ২. নতুন প্রজেক্ট তৈরি
      if (action === 'create_project') {
        if (!dbData.projects.find(p => p.name === projectName)) {
          dbData.projects.push({ name: projectName, files: [] });
        }
      }

      // ৩. ফাইলে কোড সেভ
      if (action === 'save_file') {
        const filePath = `vault/${projectName}/${fileName}`;
        
        // ফাইলটির পূর্বের SHA চেক
        let fileSha = null;
        const checkF = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=main`, { headers });
        if (checkF.ok) {
          const fd = await checkF.json();
          fileSha = fd.sha;
        }

        // ফাইল সেভ
        await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Update ${filePath}`,
            content: Buffer.from(fileContent).toString('base64'),
            sha: fileSha || undefined,
            branch: "main"
          })
        });

        // ইন্ডেক্সে যুক্ত করা
        let proj = dbData.projects.find(p => p.name === projectName);
        if (!proj) {
          proj = { name: projectName, files: [] };
          dbData.projects.push(proj);
        }
        if (!proj.files.includes(fileName)) {
          proj.files.push(fileName);
        }
      }

      // ৪. ইন্ডেক্স ফাইল আপডেট করা
      await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Sync vault index",
          content: Buffer.from(JSON.stringify(dbData, null, 2)).toString('base64'),
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
