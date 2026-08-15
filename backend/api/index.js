if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {};
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {};
}
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {};
}

const app = require('../src/app');

// Provide a default export for Vercel Serverless Functions
module.exports = app;
