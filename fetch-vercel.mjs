async function checkVercelUrl() {
  try {
    const res = await fetch("https://desembre-partner-9cihccfty-desembres-projects.vercel.app/customers");
    console.log("Status:", res.status);
    console.log("x-vercel-git-commit-sha:", res.headers.get("x-vercel-git-commit-sha"));
    console.log("x-vercel-git-commit-message:", res.headers.get("x-vercel-git-commit-message"));
  } catch (e) {
    console.error(e);
  }
}
checkVercelUrl();
