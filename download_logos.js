const https = require('https');
const fs = require('fs');
const path = require('path');

const downloads = [
  {
    name: 'vnpay-logo.png',
    urls: [
      'https://sandbox.vnpayment.vn/paymentv2/Images/brands/logo-vnpay.png',
      'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR.png',
      'https://haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR.png'
    ],
    dest: path.join(__dirname, 'apps', 'customer', 'public', 'vnpay-logo.png')
  },
  {
    name: 'momo-logo.png',
    urls: [
      'https://img.mservice.io/momo-payment/icon/images/logo512.png',
      'https://raw.githubusercontent.com/Orz-3/mini/master/Color/momo.png'
    ],
    dest: path.join(__dirname, 'apps', 'customer', 'public', 'momo-logo.png')
  }
];

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

function downloadWithFallbacks(urls, dest, index = 0) {
  if (index >= urls.length) {
    console.error(`Failed to download all fallback URLs for ${dest}`);
    return;
  }

  const url = urls[index];
  console.log(`Trying to download from: ${url}`);

  const file = fs.createWriteStream(dest);

  https.get(url, options, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
      const redirectUrl = response.headers.location;
      https.get(redirectUrl, options, (res2) => {
        if (res2.statusCode === 200) {
          res2.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Successfully downloaded ${dest} from redirect: ${redirectUrl}`);
          });
        } else {
          file.close();
          fs.unlink(dest, () => {});
          downloadWithFallbacks(urls, dest, index + 1);
        }
      }).on('error', () => {
        file.close();
        fs.unlink(dest, () => {});
        downloadWithFallbacks(urls, dest, index + 1);
      });
    } else if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${dest}`);
      });
    } else {
      file.close();
      fs.unlink(dest, () => {});
      downloadWithFallbacks(urls, dest, index + 1);
    }
  }).on('error', (err) => {
    file.close();
    fs.unlink(dest, () => {});
    downloadWithFallbacks(urls, dest, index + 1);
  });
}

downloads.forEach((item) => {
  downloadWithFallbacks(item.urls, item.dest, 0);
});
