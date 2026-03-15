const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  console.log('Navigating to board...');
  await page.goto('http://localhost:3000/board/cmmg5kql6000n6jihzijjw839', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // Wait a bit for the board to fully load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Taking full page screenshot...');
  await page.screenshot({ 
    path: 'screenshot-full-board.png'
  });
  console.log('✓ Full page screenshot saved as screenshot-full-board.png');
  
  // Get video shape information
  console.log('\nSearching for video shape...');
  const videoShapeInfo = await page.evaluate(() => {
    const shapes = Array.from(document.querySelectorAll('[data-shape-type]'));
    const videoShapes = shapes.filter(el => el.dataset.shapeType === 'video');
    
    return videoShapes.map(el => {
      const rect = el.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(el);
      
      // Look for filename in the shape
      const filenameEl = el.querySelector('[class*="filename"], [class*="title"]');
      const filename = filenameEl ? filenameEl.textContent : 'Not found';
      
      // Look for comment input
      const commentInput = el.querySelector('input[placeholder*="コメント"], textarea[placeholder*="コメント"]');
      const commentInputInfo = commentInput ? {
        visible: commentInput.offsetParent !== null,
        placeholder: commentInput.placeholder,
        rect: commentInput.getBoundingClientRect()
      } : null;
      
      return {
        shapeType: el.dataset.shapeType,
        filename: filename,
        inlineStyles: {
          width: el.style.width,
          height: el.style.height
        },
        computedStyles: {
          width: computedStyle.width,
          height: computedStyle.height
        },
        boundingRect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        },
        commentInput: commentInputInfo
      };
    });
  });
  
  console.log('\n=== Video Shape Information ===');
  console.log(JSON.stringify(videoShapeInfo, null, 2));
  
  // Open DevTools and run console command
  console.log('\nOpening DevTools...');
  const client = await page.target().createCDPSession();
  
  // Execute the console command
  console.log('\nRunning console command...');
  const consoleResult = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[data-shape-type]').forEach(el => {
      results.push({
        type: el.dataset.shapeType,
        width: el.style.width,
        height: el.style.height
      });
    });
    return results;
  });
  
  console.log('\n=== Console Output (All Shapes) ===');
  consoleResult.forEach(result => {
    console.log(`${result.type}: width=${result.width}, height=${result.height}`);
  });
  
  // Take a screenshot focused on the video shape
  if (videoShapeInfo.length > 0) {
    const videoRect = videoShapeInfo[0].boundingRect;
    console.log('\nTaking screenshot of video shape area...');
    await page.screenshot({
      path: 'screenshot-video-shape-area.png',
      clip: {
        x: Math.max(0, videoRect.left - 20),
        y: Math.max(0, videoRect.top - 20),
        width: Math.min(1920, videoRect.width + 40),
        height: Math.min(1080, videoRect.height + 40)
      }
    });
    console.log('✓ Video shape screenshot saved as screenshot-video-shape-area.png');
  }
  
  // Save results to file
  fs.writeFileSync('video-shape-inspection-results.json', JSON.stringify({
    videoShapes: videoShapeInfo,
    allShapes: consoleResult,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log('\n✓ Results saved to video-shape-inspection-results.json');
  
  console.log('\nKeeping browser open for 10 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
  console.log('\nDone!');
})();
