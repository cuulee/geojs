// var resemble = require('node-resemble');
var $ = require('jquery');

module.exports = {};

/* Compare an image from a canvas object by sending it to our express server
 * letting it do the work.
 *
 * @param {string} name: name of the base image.  This is probably the name of
 *    the test.
 * @param {HTMLCanvasObject} canvas: the image is obtained via
 *    canvas.toDataURL().
 * @param {number} threshold: allowed difference between this image and the
 *    base image.
 * @param {function} callback: a function to call when complete.
 * @returns {object} jquery ajax promise.
 */
function compareImage(name, canvas, threshold, callback) {
  if (threshold === undefined) {
    threshold = 0.001;
  }
  var data, params = '';
  if (canvas.screenCoordinates) {
    params = '&screen=true&left=' + encodeURIComponent(canvas.left) +
             '&top=' + encodeURIComponent(canvas.top) +
             '&width=' + encodeURIComponent(canvas.width) +
             '&height=' + encodeURIComponent(canvas.height);
  } else {
    data = '' + canvas.toDataURL();
  }
  return $.ajax({
    url: '/testImage?compare=true&threshold=' + encodeURIComponent(threshold) + '&name=' + encodeURIComponent(name) + params,
    data: data,
    method: 'PUT',
    contentType: 'image/png',
    dataType: 'json'
  }).done(function (data) {
    expect(Number(data.misMatchPercentage) * 0.01).not.toBeGreaterThan(threshold);
    if (callback) {
      callback();
    }
  });
}

/**
 * Call this before creating any geojs canvas instances to ensure that the
 * image test can collect data.
 */
module.exports.prepareImageTest = function () {
  window.contextPreserveDrawingBuffer = true;
  $('#map').remove();
  var map = $('<div id="map"/>').css({width: '800px', height: '600px'});
  $('body').prepend(map);
};

module.exports.prepareIframeTest = function () {
  window.contextPreserveDrawingBuffer = true;
  $('#map').remove();
  var map = $('<iframe id="map"/>').css({
    width: '800px', height: '600px', border: 0});
  $('body').prepend(map);
};

/**
 * Compare a screen region or a composite of all canvas elements with a base
 * image.
 *
 * @param {string} name: name of the base image.  This is probably the name of
 *    the test.
 * @param {string|null} elemSelector: if present, ask the server to take a
 *    screenshot of the current display and crop it to the bounds of the
 *    specified element.  If falsy, make a composite of all canvas elements.
 * @param {number} threshold: allowed difference between this image and the
 *    base image.
 * @param {function} doneFunc: a function to call when complete.  Optional.
 * @param {function} idleFunc: a function to call to ensure that the map is
 *    idle.  No other tests or delays are supplied until this is called.  It
 *    is expected to take a callback function itself.
 * @param {number} delay: additional delay in milliseconds to wait after idle.
 * @param {integer} rafCount: additional number of renderAnimationFrames to
 *    wait after the delay.
 * @param {string|null} elemSelector: if present, wait until this selector
 *    selects at least one existing element.
 */
module.exports.imageTest = function (name, elemSelector, threshold, doneFunc, idleFunc, delay, rafCount, readySelector) {
  var deferred = $.Deferred();

  var readyFunc = function () {
    var result;
    if (!elemSelector) {
      result = $('<canvas>')[0];
      result.width = $('canvas')[0].width;
      result.height = $('canvas')[0].height;
      var context = result.getContext('2d');
      context.fillStyle = 'white';
      context.fillRect(0, 0, result.width, result.height);
      $('canvas').each(function () {
        context.drawImage($(this)[0], 0, 0);
      });
    } else {
      var innerScreenX = window.mozInnerScreenX !== undefined ?
            window.mozInnerScreenX :
            (window.outerWidth - window.innerWidth) / 2 + window.screenX,
          innerScreenY = window.mozInnerScreenY !== undefined ?
            window.mozInnerScreenY :
            window.outerHeight - window.innerHeight -
            (window.outerWidth - window.innerWidth) / 2 + window.screenY;
      result = {
        screenCoordinates: true,
        left: $(elemSelector).offset().left + innerScreenX,
        top: $(elemSelector).offset().top + innerScreenY,
        width: $(elemSelector).outerWidth(true),
        height: $(elemSelector).outerHeight(true)
      };
    }
    compareImage(name, result, threshold, function () {
      if (doneFunc) {
        doneFunc();
      }
      deferred.resolve();
    });
  };

  var rafCounter = rafCount === undefined ? 2 : rafCount;

  if (rafCounter) {
    var rafCallback = readyFunc;
    var rafFunc = function () {
      if (rafCounter <= 0) {
        rafCallback();
      } else {
        window.requestAnimationFrame(function () {
          rafCounter -= 1;
          rafFunc();
        });
      }
    };
    readyFunc = rafFunc;
  }

  if (delay) {
    var delayFunc = readyFunc;
    readyFunc = function () {
      window.setTimeout(delayFunc, delay);
    };
  }

  if (readySelector) {
    var selFunc = readyFunc;
    var selWaitFunc;
    selWaitFunc = function () {
      var baseJquery = $,
          base = $('iframe#map');
      if (base.length) {
        baseJquery = base[0].contentWindow.jQuery;
      }
      if (!baseJquery || !baseJquery(readySelector).length) {
        window.setTimeout(selWaitFunc, 50);
        return;
      }
      selFunc();
    };
    readyFunc = selWaitFunc;
  }

  if (idleFunc) {
    idleFunc(readyFunc);
  } else {
    readyFunc();
  }
  return deferred;
};
