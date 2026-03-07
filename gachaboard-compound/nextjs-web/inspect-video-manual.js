const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser with existing profile...');
  
  // Launch browser with user data directory to use existing session
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    // Use Chrome user data directory to maintain login session
    userDataDir: '/tmp/puppeteer-profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('\n=== Instructions ===');
  console.log('1. Please log in to Discord if needed');
  console.log('2. Navigate to: http://localhost:3000/board/cmmg5kql6000n6jihzijjw839');
  console.log('3. Wait for the board to load completely');
  console.log('4. Press Enter in this terminal when ready...\n');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  console.log('\nCollecting video shape information...');
  
  // Get video shape information
  const videoShapeInfo = await page.evaluate(() => {
    const shapes = Array.from(document.querySelectorAll('[data-shape-type]'));
    const videoShapes = shapes.filter(el => el.dataset.shapeType === 'video');
    
    return videoShapes.map(el => {
      const rect = el.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(el);
      
      // Look for HTMLContainer div with explicit dimensions
      const htmlContainer = el.querySelector('[class*="HTMLContainer"]');
      const htmlContainerInfo = htmlContainer ? {
        inlineWidth: htmlContainer.style.width,
        inlineHeight: htmlContainer.style.height,
        computedWidth: window.getComputedStyle(htmlContainer).width,
        computedHeight: window.getComputedStyle(htmlContainer).height
      } : null;
      
      // Look for filename
      const textElements = el.querySelectorAll('*');
      let filename = 'Not found';
      for (const textEl of textElements) {
        const text = textEl.textContent;
        if (text && text.includes('.MP4') || text.includes('.mp4')) {
          filename = text;
          break;
        }
      }
      
      // Look for comment input
      const commentInput = el.querySelector('input[placeholder*="コメント"], textarea[placeholder*="コメント"]');
      let commentInputInfo = null;
      if (commentInput) {
        const inputRect = commentInput.getBoundingClientRect();
        const parentRect = commentInput.parentElement?.getBoundingClientRect();
        commentInputInfo = {
          visible: commentInput.offsetParent !== null,
          placeholder: commentInput.placeholder,
          rect: {
            top: inputRect.top,
            left: inputRect.left,
            width: inputRect.width,
            height: inputRect.height,
            bottom: inputRect.bottom
          },
          parentRect: parentRect ? {
            top: parentRect.top,
            left: parentRect.left,
            width: parentRect.width,
            height: parentRect.height,
            bottom: parentRect.bottom
          } : null,
          isClipped: false
        };
        
        // Check if comment input is clipped by shape border
        const shapeRect = el.getBoundingClientRect();
        if (inputRect.bottom > shapeRect.bottom) {
          commentInputInfo.isClipped = true;
          commentInputInfo.clippedBy = inputRect.bottom - shapeRect.bottom;
        }
      }
      
      return {
        shapeType: el.dataset.shapeType,
        filename: filename,
        inlineStyles: {
          width: el.style.width,
          height: el.style.height
        },
        computedStyles: {
          width: computedStyle.width,
          height: computedStyle.height,
          overflow: computedStyle.overflow
        },
        boundingRect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        },
        htmlContainer: htmlContainerInfo,
        commentInput: commentInputInfo
      };
    });
  });
  
  console.log('\n=== Video Shape Information ===');
  console.log(JSON.stringify(videoShapeInfo, null, 2));
  
  // Run console command to get all shapes
  console.log('\n=== Running Console Command ===');
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
  
  console.log('All shapes:');
  consoleResult.forEach(result => {
    console.log(`  ${result.type}: width=${result.width}, height=${result.height}`);
  });
  
  // Take screenshots
  console.log('\nTaking screenshots...');
  await page.screenshot({ path: 'screenshot-inspection-full.png' });
  console.log('✓ Full screenshot saved as screenshot-inspection-full.png');
  
  if (videoShapeInfo.length > 0) {
    const videoRect = videoShapeInfo[0].boundingRect;
    await page.screenshot({
      path: 'screenshot-inspection-video.png',
      clip: {
        x: Math.max(0, videoRect.left - 20),
        y: Math.max(0, videoRect.top - 20),
        width: Math.min(1920, videoRect.width + 40),
        height: Math.min(1080, videoRect.height + 40)
      }
    });
    console.log('✓ Video shape screenshot saved as screenshot-inspection-video.png');
  }
  
  // Save results to file
  fs.writeFileSync('video-shape-inspection-detailed.json', JSON.stringify({
    videoShapes: videoShapeInfo,
    allShapes: consoleResult,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log('\n✓ Results saved to video-shape-inspection-detailed.json');
  
  console.log('\nPress Enter to close browser...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  console.log('Done!');
})();
