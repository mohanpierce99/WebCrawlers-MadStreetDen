const puppeteer = require('puppeteer');
const men = 'https://shop.mango.com/in/men';
const women = 'https://shop.mango.com/in/women';
const axios = require('axios');



var count = 0;
var master=[];
var count=0;
async function crawl(link, type, cat, res,headless=false) {

    try {
        const browser = await puppeteer.launch({
            args: ['--enable-features=NetworkService'],
            ignoreHTTPSErrors: true,
            headless
          })
        var page = await browser.newPage();
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3738.0 Safari/537.36');
        await page.setViewport({
            width: 1366,
            height: 768
        });
        await page.goto(link);



        var categories = [];


        if (type == "clothing") {
            var el = await page.$('.vsv-menu-prendas ul');
            var links = await el.$$('li a');
            for (let data of links) {
                categories.push(await data.$eval('span', sp => sp.innerText));
            }
        } else if (type == "accessories") {
            const access = await page.$('.vsv-menu-title2');
            var el = await page.evaluateHandle(x => x.nextElementSibling, access);
            var links = await el.$$('li a');

            for (let data of links) {
                categories.push(await data.$eval('span', sp => sp.innerText));
            }
        }

        console.log(categories);
        const toCrawl = [];

        if (cat) {
            let i = 0;
            for (const data of cat) {
                console.log(cat + "to be searched");
                let found = categories.map(toLower).map(trim).map((x,i)=>x==trim(data.toLowerCase())?i:-1).filter((x)=>x!=-1)[0];
                console.log(categories[found]);
                console.log(found);
                if(found==undefined){continue;}
                if (~found){
                    toCrawl.push([await page.evaluate(x => x.href, links[found]), categories[found]]);
                }
              
                i += 1;
            }
        } else {
            let i = 0;
            for (const data of links) {
                toCrawl.push([await page.evaluate(x => x.href, data), categories[i]]);
                i += 1;
            }
        }

        if (!toCrawl.length) {
            console.log("hit");
            res.write("Wrong input Type is clothing or accessories and enter the category in the ct param");
            await browser.close();
            res.end();
            return;
        }

        console.log(toCrawl);


        var control={}
        control.gate = false;
        control.bootstrap = false;
        control.crawlPointer=0;

        await page.goto(toCrawl[0][0]);
        await page.setRequestInterception(true); //Eavesdropping Network requests to find the golden start
        await page.evaluate(x=>window.location.reload());
        page.on('request',x=>brainNetwork(control,res,toCrawl,x));

        async function brainNetwork(control,responser,toCrawl,interceptedRequest){
            var i=1;
            let bootstrap1 = interceptedRequest.url().match(/(idSubSection)|(pageNum)/g);
            if (control.gate || !bootstrap1) {
                interceptedRequest.continue();
                return ;
            } 
            if (control.bootstrap = interceptedRequest.url().match(/(idSubSection)|(pageNum)/g).length==2 && !control.gate) {
                control.gate = true;
                control.bootstrap = interceptedRequest.url();
                interceptedRequest.continue();
                let category={
                    title:"",
                 items:[]
                }
                while(1){
                    let response= await axios.get(control.bootstrap.replace(/pageNum=\d+/,"pageNum="+i));
                    category.title=response.data.titleh1||response.data.products.titleh1;
                     let parsin=JSONparser(response.data);

                     if(!parsin){
                         control.crawlPointer+=1;
                         break;
                     }
                     category.items.push(parsin);
                    i+=1;
                }
                console.log(category);
                responser.write(JSON.stringify(category));
                console.log(control.crawlPointer,toCrawl.length)
                if(control.crawlPointer<toCrawl.length){
                    master=[];
                    control.gate=false;
              console.log("End of one crawl");
              try{
                await page.goto(toCrawl[control.crawlPointer][0]);
              }catch(e){
                  console.log("Website scraped");
              }
                    i=1;
                }else{
                    console.log("loop done");
                    await browser.close();
                    console.log(count+" items scrapped");
                    res.end();
                }
            }else{
                interceptedRequest.continue();
                return ;
            }
        }

       console.log("Exited"); 
    } catch (e) {
    }


}

function toLower(d) {
    return d.toLowerCase();
}


function JSONparser(data){
    var master=[];
    let title=data.titleh1;
    let groups=data.groups || data.products.groups;
if(!groups){
    return false;
}
if(!groups.length)
    return false;
let items=groups[0].garments;
    for(x of Object.keys(items)){
        let json={category:title,colors:[]};
        json.name=groups[0].garments[x].shortDescription;
        json.price=groups[0].garments[x].price.salePrice;
        for(d of groups[0].garments[x].colors){
            let images=d.images.map(obj=>obj.img1Src);
           json.colors.push({
               color:d.label,
               images
           });
        }
        master.push(json);
        count+=1;
    }
    return master;
}

function trim(d){
    return d.replace(/\s/g,'');
  }

module.exports = {
    init: function (d) {
        if (d == "men")
            return crawl.bind(null, men)
        return crawl.bind(null, women);
    }
}
