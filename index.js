const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Reonomy = require('./models/reonomy');

async function getNumPages(page) {
    const NUM_RESULT_SELECTOR = 'body > div.reo-app-container > ui-view > main > div > form > ul > li:nth-child(1) > p > b';
  
    let results = await page.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML: null;
    }, NUM_RESULT_SELECTOR);
 
    let numResults = parseInt(results);
  
    console.log('numResults: ', numResults);
  
    /*
    * Reonomy shows 50 resuls per page, so
    */
    let numPages = Math.ceil(numResults / 50);
    return numPages;
}

function upsertReonomy(reonomyObj) {
	const DB_URL = 'mongodb://localhost/reonomy';

  	if (mongoose.connection.readyState == 0) { mongoose.connect(DB_URL); }

    // if this apn exists, update the entry, don't insert
	let conditions = { apn: reonomyObj.apn };
	let options = { upsert: true, new: true, setDefaultsOnInsert: true };

    Reonomy.findOneAndUpdate(conditions, reonomyObj, options, (err, result) => {
  		if (err) throw err;
  	});
}

async function run() {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    await page.goto('https://app.reonomy.com/login');

    // dom element selectors
    const USERNAME_SELECTOR = '#email';
    const PASSWORD_SELECTOR = '#password';
    const BUTTON_SELECTOR = '#login';
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(CREDS.username);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(CREDS.password);
    await page.click(BUTTON_SELECTOR);
    await page.waitFor(3*1000);


    const SEARCH_URL = `https://app.reonomy.com/search/a0bd5b71-5c5c-fead-28e2-bdcf47d40b28/PAGENO?topLeft=40.73790034866793&topLeft=-73.92888159468204&bottomRight=40.73590034866793&bottomRight=-73.92688159468203&precision=8`;
    let pageUrl = SEARCH_URL.replace('PAGENO', 1);
    await page.goto(pageUrl);
    await page.waitFor(5*1000);

    
    const LENGTH_SELECTOR_CLASS = '';
    const LIST_ADDRESS_SELECTOR = 'div.reo-section-body > ul > li:nth-child(INDEX) > section > header > h1 > a';
    const LIST_APN_SELECTOR = 'div.reo-section-body > ul > li:nth-child(INDEX) > section > header > span > span';
    // const CROSS_BUTTON_SELECTOR = 'body > div.reo-app-container > ui-view > main > section > ui-view > ui-view > ui-view > section > header > div.ng-scope > ul > li:nth-child(3) > a';

    // await page.click(CROSS_BUTTON_SELECTOR);

    

    var fs = require('fs')
    var logger = fs.createWriteStream('result.csv', {
        flags: 'a' // 'a' means appending (old data will be preserved)
    })
    logger.write('address,apn\n')

    let numPages = await getNumPages(page);
    console.log('Numpages: ', numPages);
    for (let h = 1; h <= numPages; h++) {

        let pageUrl = SEARCH_URL.replace('PAGENO', h);
        await page.goto(pageUrl);
        await page.waitFor(5*1000);
        for (let i = 1; i <= 50; i++) {
            // change the index to the next child
            let addressSelector = LIST_ADDRESS_SELECTOR.replace("INDEX", i);
            let apnSelector = LIST_APN_SELECTOR.replace("INDEX", i);

            let address = await page.evaluate((sel) => {
                let element = document.querySelector(sel);
                return element? element.textContent: null;
            }, addressSelector);
            if (address == null) continue;
            address = address.trim();

            let apn = await page.evaluate((sel) => {
                let element = document.querySelector(sel);
                return element? element.textContent: null;
            }, apnSelector);
            apn = apn.trim();

            console.log(address, ' : ', apn);

            // TODO save this users
            upsertReonomy({
                address: address,
                apn: apn,
                dateCrawled: new Date()
            });
            logger.write(address + ',' + apn + '\n');
        }
    }
    logger.end() 
    // browser.close();
}
run();