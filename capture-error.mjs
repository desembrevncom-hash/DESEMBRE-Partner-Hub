import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Listen to console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR (Exception):', error.message);
    console.log('STACK:', error.stack);
  });

  console.log("Navigating to preview...");
  await page.goto('https://desembre-partner-fx4bx6jbl-desembres-projects.vercel.app/customers', { waitUntil: 'networkidle0' });

  // Wait a bit to ensure React finishes mounting
  await new Promise(r => setTimeout(r, 2000));

  // Extract the text of the error boundary if it exists
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes("Đã có lỗi xảy ra")) {
    console.log("FOUND ERROR BOUNDARY TEXT");
    
    // Check if there is a 'Báo lỗi chi tiết' button and click it to get stack trace
    const btn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const errorBtn = btns.find(b => b.innerText.includes('Báo lỗi'));
      if (errorBtn) {
        errorBtn.click();
        return true;
      }
      return false;
    });

    if (btn) {
      await new Promise(r => setTimeout(r, 1000));
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log("TEXT AFTER CLICKING DETAILS:", bodyText);
    }
  }

  await browser.close();
})();
