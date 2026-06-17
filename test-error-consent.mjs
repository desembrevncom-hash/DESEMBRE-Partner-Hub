import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR (Exception):', error.message);
    console.log('STACK:', error.stack);
  });

  console.log("Navigating to http://localhost:4173/marketing/consent ...");
  await page.goto('http://localhost:4173/marketing/consent', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
