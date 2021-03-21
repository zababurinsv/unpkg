'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var cors = _interopDefault(require('cors'));
var express = _interopDefault(require('express'));
var morgan = _interopDefault(require('morgan'));
var path = _interopDefault(require('path'));
var tar = _interopDefault(require('tar-stream'));
var mime = _interopDefault(require('mime'));
var SRIToolbox = _interopDefault(require('sri-toolbox'));
var url = _interopDefault(require('url'));
var https = _interopDefault(require('https'));
var gunzip = _interopDefault(require('gunzip-maybe'));
var LRUCache = _interopDefault(require('lru-cache'));
var server$1 = require('react-dom/server');
var semver = _interopDefault(require('semver'));
var core = require('@emotion/core');
var React = require('react');
var PropTypes = _interopDefault(require('prop-types'));
var VisuallyHidden = _interopDefault(require('@reach/visually-hidden'));
var sortBy = _interopDefault(require('sort-by'));
var formatBytes = _interopDefault(require('pretty-bytes'));
var jsesc = _interopDefault(require('jsesc'));
var hljs = _interopDefault(require('highlight.js'));
var etag = _interopDefault(require('etag'));
var cheerio = _interopDefault(require('cheerio'));
var babel = _interopDefault(require('@babel/core'));
var URL = _interopDefault(require('whatwg-url'));
var warning = _interopDefault(require('warning'));
var dateFns = require('date-fns');
var fetch$1 = _interopDefault(require('isomorphic-fetch'));
var util = _interopDefault(require('util'));
var validateNpmPackageName = _interopDefault(require('validate-npm-package-name'));

/**
 * Useful for wrapping `async` request handlers in Express
 * so they automatically propagate errors.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(error => {
      req.log.error(`Unexpected error in ${handler.name}!`);
      req.log.error(error.stack);
      next(error);
    });
  };
}

function bufferStream(stream) {
  return new Promise((accept, reject) => {
    const chunks = [];
    stream.on('error', reject).on('data', chunk => chunks.push(chunk)).on('end', () => accept(Buffer.concat(chunks)));
  });
}

mime.define({
  'text/plain': ['authors', 'changes', 'license', 'makefile', 'patents', 'readme', 'ts', 'flow']
},
/* force */
true);
const textFiles = /\/?(\.[a-z]*rc|\.git[a-z]*|\.[a-z]*ignore|\.lock)$/i;
function getContentType(file) {
  const name = path.basename(file);
  return textFiles.test(name) ? 'text/plain' : mime.getType(name) || 'text/plain';
}

function getIntegrity(data) {
  return SRIToolbox.generate({
    algorithms: ['sha384']
  }, data);
}

const npmRegistryURL =  'https://registry.npmjs.org';
const agent = new https.Agent({
  keepAlive: true
});
const oneMegabyte = 1024 * 1024;
const oneSecond = 1000;
const oneMinute = oneSecond * 60;
const cache = new LRUCache({
  max: oneMegabyte * 40,
  length: Buffer.byteLength,
  maxAge: oneSecond
});
const notFound = '';

function get(options) {
  return new Promise((accept, reject) => {
    https.get(options, accept).on('error', reject);
  });
}

function isScopedPackageName(packageName) {
  return packageName.startsWith('@');
}

function encodePackageName(packageName) {
  return isScopedPackageName(packageName) ? `@${encodeURIComponent(packageName.substring(1))}` : encodeURIComponent(packageName);
}

async function fetchPackageInfo(packageName, log) {
  const name = encodePackageName(packageName);
  const infoURL = `${npmRegistryURL}/${name}`;
  log.debug('Fetching package info for %s from %s', packageName, infoURL);
  const {
    hostname,
    pathname
  } = url.parse(infoURL);
  const options = {
    agent: agent,
    hostname: hostname,
    path: pathname,
    headers: {
      Accept: 'application/json'
    }
  };
  const res = await get(options);

  if (res.statusCode === 200) {
    return bufferStream(res).then(JSON.parse);
  }

  if (res.statusCode === 404) {
    return null;
  }

  const content = (await bufferStream(res)).toString('utf-8');
  log.error('Error fetching info for %s (status: %s)', packageName, res.statusCode);
  log.error(content);
  return null;
}

async function fetchVersionsAndTags(packageName, log) {
  const info = await fetchPackageInfo(packageName, log);
  return info && info.versions ? {
    versions: Object.keys(info.versions),
    tags: info['dist-tags']
  } : null;
}
/**
 * Returns an object of available { versions, tags }.
 * Uses a cache to avoid over-fetching from the registry.
 */


async function getVersionsAndTags(packageName, log) {
  const cacheKey = `versions-${packageName}`;
  const cacheValue = cache.get(cacheKey);

  if (cacheValue != null) {
    return cacheValue === notFound ? null : JSON.parse(cacheValue);
  }

  const value = await fetchVersionsAndTags(packageName, log);

  if (value == null) {
    cache.set(cacheKey, notFound, 5 * oneMinute);
    return null;
  }

  cache.set(cacheKey, JSON.stringify(value), oneMinute);
  return value;
} // All the keys that sometimes appear in package info
// docs that we don't need. There are probably more.

const packageConfigExcludeKeys = ['browserify', 'bugs', 'directories', 'engines', 'files', 'homepage', 'keywords', 'maintainers', 'scripts'];

function cleanPackageConfig(config) {
  return Object.keys(config).reduce((memo, key) => {
    if (!key.startsWith('_') && !packageConfigExcludeKeys.includes(key)) {
      memo[key] = config[key];
    }

    return memo;
  }, {});
}

async function fetchPackageConfig(packageName, version, log) {
  const info = await fetchPackageInfo(packageName, log);
  return info && info.versions && version in info.versions ? cleanPackageConfig(info.versions[version]) : null;
}
/**
 * Returns metadata about a package, mostly the same as package.json.
 * Uses a cache to avoid over-fetching from the registry.
 */


async function getPackageConfig(packageName, version, log) {
  const cacheKey = `config-${packageName}-${version}`;
  const cacheValue = cache.get(cacheKey);

  if (cacheValue != null) {
    return cacheValue === notFound ? null : JSON.parse(cacheValue);
  }

  const value = await fetchPackageConfig(packageName, version, log);

  if (value == null) {
    cache.set(cacheKey, notFound, 5 * oneMinute);
    return null;
  }

  cache.set(cacheKey, JSON.stringify(value), oneMinute);
  return value;
}
/**
 * Returns a stream of the tarball'd contents of the given package.
 */

async function getPackage(packageName, version, log) {
  const tarballName = isScopedPackageName(packageName) ? packageName.split('/')[1] : packageName;
  const tarballURL = `${npmRegistryURL}/${packageName}/-/${tarballName}-${version}.tgz`;
  log.debug('Fetching package for %s from %s', packageName, tarballURL);
  const {
    hostname,
    pathname
  } = url.parse(tarballURL);
  const options = {
    agent: agent,
    hostname: hostname,
    path: pathname
  };
  const res = await get(options);

  if (res.statusCode === 200) {
    const stream = res.pipe(gunzip()); // stream.pause();

    return stream;
  }

  if (res.statusCode === 404) {
    return null;
  }

  const content = (await bufferStream(res)).toString('utf-8');
  log.error('Error fetching tarball for %s@%s (status: %s)', packageName, version, res.statusCode);
  log.error(content);
  return null;
}

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _taggedTemplateLiteralLoose(strings, raw) {
  if (!raw) {
    raw = strings.slice(0);
  }

  strings.raw = raw;
  return strings;
}

var fontSans = "\nfont-family: -apple-system,\n  BlinkMacSystemFont,\n  \"Segoe UI\",\n  \"Roboto\",\n  \"Oxygen\",\n  \"Ubuntu\",\n  \"Cantarell\",\n  \"Fira Sans\",\n  \"Droid Sans\",\n  \"Helvetica Neue\",\n  sans-serif;\n";
var fontMono = "\nfont-family: Menlo,\n  Monaco,\n  Lucida Console,\n  Liberation Mono,\n  DejaVu Sans Mono,\n  Bitstream Vera Sans Mono,\n  Courier New,\n  monospace;\n";

function formatNumber(n) {
  var digits = String(n).split('');
  var groups = [];

  while (digits.length) {
    groups.unshift(digits.splice(-3).join(''));
  }

  return groups.join(',');
}
function formatPercent(n, decimals) {
  if (decimals === void 0) {
    decimals = 1;
  }

  return (n * 100).toPrecision(decimals + 2);
}

var maxWidth = 700;
function ContentArea(_ref) {
  var _extends2;

  var children = _ref.children,
      css = _ref.css;
  return core.jsx("div", {
    css: _extends((_extends2 = {
      border: '1px solid #dfe2e5',
      borderRadius: 3
    }, _extends2["@media (max-width: " + maxWidth + "px)"] = {
      borderRightWidth: 0,
      borderLeftWidth: 0
    }, _extends2), css)
  }, children);
}
function ContentAreaHeaderBar(_ref2) {
  var _extends3;

  var children = _ref2.children,
      css = _ref2.css;
  return core.jsx("div", {
    css: _extends((_extends3 = {
      padding: 10,
      background: '#f6f8fa',
      color: '#424242',
      border: '1px solid #d1d5da',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      margin: '-1px -1px 0',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    }, _extends3["@media (max-width: " + maxWidth + "px)"] = {
      paddingRight: 20,
      paddingLeft: 20
    }, _extends3), css)
  }, children);
}

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = React.createContext && React.createContext(DefaultContext);

var __assign = global && global.__assign || function () {
  __assign = Object.assign || function (t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];

      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }

    return t;
  };

  return __assign.apply(this, arguments);
};

var __rest = global && global.__rest || function (s, e) {
  var t = {};

  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];

  if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];
  return t;
};

function Tree2Element(tree) {
  return tree && tree.map(function (node, i) {
    return React.createElement(node.tag, __assign({
      key: i
    }, node.attr), Tree2Element(node.child));
  });
}

function GenIcon(data) {
  return function (props) {
    return React.createElement(IconBase, __assign({
      attr: __assign({}, data.attr)
    }, props), Tree2Element(data.child));
  };
}
function IconBase(props) {
  var elem = function (conf) {
    var computedSize = props.size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + ' ' : '') + props.className;

    var attr = props.attr,
        title = props.title,
        svgProps = __rest(props, ["attr", "title"]);

    return React.createElement("svg", __assign({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: __assign({
        color: props.color || conf.color
      }, conf.style, props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && React.createElement("title", null, title), props.children);
  };

  return IconContext !== undefined ? React.createElement(IconContext.Consumer, null, function (conf) {
    return elem(conf);
  }) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function GoFileCode (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 12 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM5 6.98L3.5 8.5 5 10l-.5 1L2 8.5 4.5 6l.5.98zM7.5 6L10 8.5 7.5 11l-.5-.98L8.5 8.5 7 7l.5-1z"}}]})(props);
}function GoFileDirectory (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 14 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z"}}]})(props);
}function GoFile (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 12 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z"}}]})(props);
}

// THIS FILE IS AUTO GENERATED
function FaGithub (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 496 512"},"child":[{"tag":"path","attr":{"d":"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"}}]})(props);
}function FaTwitter (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"}}]})(props);
}

function createIcon(Type, _ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return core.jsx(Type, _extends({
    css: _extends({}, css, {
      verticalAlign: 'text-bottom'
    })
  }, rest));
}

function FileIcon(props) {
  return createIcon(GoFile, props);
}
function FileCodeIcon(props) {
  return createIcon(GoFileCode, props);
}
function FolderIcon(props) {
  return createIcon(GoFileDirectory, props);
}
function TwitterIcon(props) {
  return createIcon(FaTwitter, props);
}
function GitHubIcon(props) {
  return createIcon(FaGithub, props);
}

var linkStyle = {
  color: '#0076ff',
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline'
  }
};
var tableCellStyle = {
  paddingTop: 6,
  paddingRight: 3,
  paddingBottom: 6,
  paddingLeft: 3,
  borderTop: '1px solid #eaecef'
};

var iconCellStyle = _extends({}, tableCellStyle, {
  color: '#424242',
  width: 17,
  paddingRight: 2,
  paddingLeft: 10,
  '@media (max-width: 700px)': {
    paddingLeft: 20
  }
});

var typeCellStyle = _extends({}, tableCellStyle, {
  textAlign: 'right',
  paddingRight: 10,
  '@media (max-width: 700px)': {
    paddingRight: 20
  }
});

function getRelName(path, base) {
  return path.substr(base.length > 1 ? base.length + 1 : 1);
}

function FolderViewer(_ref) {
  var path = _ref.path,
      entries = _ref.details;

  var _Object$keys$reduce = Object.keys(entries).reduce(function (memo, key) {
    var subdirs = memo.subdirs,
        files = memo.files;
    var entry = entries[key];

    if (entry.type === 'directory') {
      subdirs.push(entry);
    } else if (entry.type === 'file') {
      files.push(entry);
    }

    return memo;
  }, {
    subdirs: [],
    files: []
  }),
      subdirs = _Object$keys$reduce.subdirs,
      files = _Object$keys$reduce.files;

  subdirs.sort(sortBy('path'));
  files.sort(sortBy('path'));
  var rows = [];

  if (path !== '/') {
    rows.push(core.jsx("tr", {
      key: ".."
    }, core.jsx("td", {
      css: iconCellStyle
    }), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: "Parent directory",
      href: "../",
      css: linkStyle
    }, "..")), core.jsx("td", {
      css: tableCellStyle
    }), core.jsx("td", {
      css: typeCellStyle
    })));
  }

  subdirs.forEach(function (_ref2) {
    var dirname = _ref2.path;
    var relName = getRelName(dirname, path);
    var href = relName + '/';
    rows.push(core.jsx("tr", {
      key: relName
    }, core.jsx("td", {
      css: iconCellStyle
    }, core.jsx(FolderIcon, null)), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: relName,
      href: href,
      css: linkStyle
    }, relName)), core.jsx("td", {
      css: tableCellStyle
    }, "-"), core.jsx("td", {
      css: typeCellStyle
    }, "-")));
  });
  files.forEach(function (_ref3) {
    var filename = _ref3.path,
        size = _ref3.size,
        contentType = _ref3.contentType;
    var relName = getRelName(filename, path);
    var href = relName;
    rows.push(core.jsx("tr", {
      key: relName
    }, core.jsx("td", {
      css: iconCellStyle
    }, contentType === 'text/plain' || contentType === 'text/markdown' ? core.jsx(FileIcon, null) : core.jsx(FileCodeIcon, null)), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: relName,
      href: href,
      css: linkStyle
    }, relName)), core.jsx("td", {
      css: tableCellStyle
    }, formatBytes(size)), core.jsx("td", {
      css: typeCellStyle
    }, contentType)));
  });
  var counts = [];

  if (files.length > 0) {
    counts.push(files.length + " file" + (files.length === 1 ? '' : 's'));
  }

  if (subdirs.length > 0) {
    counts.push(subdirs.length + " folder" + (subdirs.length === 1 ? '' : 's'));
  }

  return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx("span", null, counts.join(', '))), core.jsx("table", {
    css: {
      width: '100%',
      borderCollapse: 'collapse',
      borderRadius: 2,
      background: '#fff',
      '@media (max-width: 700px)': {
        '& th + th + th + th, & td + td + td + td': {
          display: 'none'
        }
      },
      '& tr:first-of-type td': {
        borderTop: 0
      }
    }
  }, core.jsx("thead", null, core.jsx("tr", null, core.jsx("th", null, core.jsx(VisuallyHidden, null, "Icon")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Name")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Size")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Content Type")))), core.jsx("tbody", null, rows)));
}

if (process.env.NODE_ENV !== 'production') {
  FolderViewer.propTypes = {
    path: PropTypes.string.isRequired,
    details: PropTypes.objectOf(PropTypes.shape({
      path: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['directory', 'file']).isRequired,
      contentType: PropTypes.string,
      // file only
      integrity: PropTypes.string,
      // file only
      size: PropTypes.number // file only

    })).isRequired
  };
}

function createHTML(content) {
  return {
    __html: content
  };
}

/** @jsx jsx */

function getBasename(path) {
  var segments = path.split('/');
  return segments[segments.length - 1];
}

function ImageViewer(_ref) {
  var path = _ref.path,
      uri = _ref.uri;
  return core.jsx("div", {
    css: {
      padding: 20,
      textAlign: 'center'
    }
  }, core.jsx("img", {
    alt: getBasename(path),
    src: uri
  }));
}

function CodeListing(_ref2) {
  var highlights = _ref2.highlights;
  var lines = highlights.slice(0);
  var hasTrailingNewline = lines.length && lines[lines.length - 1] === '';

  if (hasTrailingNewline) {
    lines.pop();
  }

  return core.jsx("div", {
    className: "code-listing",
    css: {
      overflowX: 'auto',
      overflowY: 'hidden',
      paddingTop: 5,
      paddingBottom: 5
    }
  }, core.jsx("table", {
    css: {
      border: 'none',
      borderCollapse: 'collapse',
      borderSpacing: 0
    }
  }, core.jsx("tbody", null, lines.map(function (line, index) {
    var lineNumber = index + 1;
    return core.jsx("tr", {
      key: index
    }, core.jsx("td", {
      id: "L" + lineNumber,
      css: {
        paddingLeft: 10,
        paddingRight: 10,
        color: 'rgba(27,31,35,.3)',
        textAlign: 'right',
        verticalAlign: 'top',
        width: '1%',
        minWidth: 50,
        userSelect: 'none'
      }
    }, core.jsx("span", null, lineNumber)), core.jsx("td", {
      id: "LC" + lineNumber,
      css: {
        paddingLeft: 10,
        paddingRight: 10,
        color: '#24292e',
        whiteSpace: 'pre'
      }
    }, core.jsx("code", {
      dangerouslySetInnerHTML: createHTML(line)
    })));
  }), !hasTrailingNewline && core.jsx("tr", {
    key: "no-newline"
  }, core.jsx("td", {
    css: {
      paddingLeft: 10,
      paddingRight: 10,
      color: 'rgba(27,31,35,.3)',
      textAlign: 'right',
      verticalAlign: 'top',
      width: '1%',
      minWidth: 50,
      userSelect: 'none'
    }
  }, "\\"), core.jsx("td", {
    css: {
      paddingLeft: 10,
      color: 'rgba(27,31,35,.3)',
      userSelect: 'none'
    }
  }, "No newline at end of file")))));
}

function BinaryViewer() {
  return core.jsx("div", {
    css: {
      padding: 20
    }
  }, core.jsx("p", {
    css: {
      textAlign: 'center'
    }
  }, "No preview available."));
}

function FileViewer(_ref3) {
  var packageName = _ref3.packageName,
      packageVersion = _ref3.packageVersion,
      path = _ref3.path,
      details = _ref3.details;
  var highlights = details.highlights,
      uri = details.uri,
      language = details.language,
      size = details.size;
  return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx("span", null, formatBytes(size)), core.jsx("span", null, language), core.jsx("span", null, core.jsx("a", {
    href: "/" + packageName + "@" + packageVersion + path,
    css: {
      display: 'inline-block',
      marginLeft: 8,
      padding: '2px 8px',
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '0.9rem',
      color: '#24292e',
      backgroundColor: '#eff3f6',
      border: '1px solid rgba(27,31,35,.2)',
      borderRadius: 3,
      ':hover': {
        backgroundColor: '#e6ebf1',
        borderColor: 'rgba(27,31,35,.35)'
      },
      ':active': {
        backgroundColor: '#e9ecef',
        borderColor: 'rgba(27,31,35,.35)',
        boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'
      }
    }
  }, "View Raw"))), highlights ? core.jsx(CodeListing, {
    highlights: highlights
  }) : uri ? core.jsx(ImageViewer, {
    path: path,
    uri: uri
  }) : core.jsx(BinaryViewer, null));
}

if (process.env.NODE_ENV !== 'production') {
  FileViewer.propTypes = {
    path: PropTypes.string.isRequired,
    details: PropTypes.shape({
      contentType: PropTypes.string.isRequired,
      highlights: PropTypes.arrayOf(PropTypes.string),
      // code
      uri: PropTypes.string,
      // images
      integrity: PropTypes.string.isRequired,
      language: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired
    }).isRequired
  };
}

var SelectDownArrow = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAAAXNSR0IArs4c6QAAARFJREFUKBVjZAACNS39RhBNKrh17WI9o4quoT3Dn78HSNUMUs/CzOTI/O7Vi4dCYpJ3/jP+92BkYGAlyiBGhm8MjIxJt65e3MQM0vDu9YvLYmISILYZELOBxHABRkaGr0yMzF23r12YDFIDNgDEePv65SEhEXENBkYGFSAXuyGMjF8Z/jOsvX3tYiFIDwgwQSgIaaijnvj/P8M5IO8HsjiY/f//D4b//88A1SQhywG9jQr09PS4v/1mPAeUUPzP8B8cJowMjL+Bqu6xMQmaXL164AuyDgwDQJLa2qYSP//9vARkCoMVMzK8YeVkNbh+9uxzMB+JwGoASF5Vx0jz/98/18BqmZi171w9D2EjaaYKEwAEK00XQLdJuwAAAABJRU5ErkJggg==";

var _templateObject, _templateObject2;
var buildId = "fd447fa";
var globalStyles = core.css(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  html {\n    box-sizing: border-box;\n  }\n  *,\n  *:before,\n  *:after {\n    box-sizing: inherit;\n  }\n\n  html,\n  body,\n  #root {\n    height: 100%;\n    margin: 0;\n  }\n\n  body {\n    ", "\n    font-size: 16px;\n    line-height: 1.5;\n    overflow-wrap: break-word;\n    background: white;\n    color: black;\n  }\n\n  code {\n    ", "\n  }\n\n  th,\n  td {\n    padding: 0;\n  }\n\n  select {\n    font-size: inherit;\n  }\n\n  #root {\n    display: flex;\n    flex-direction: column;\n  }\n"])), fontSans, fontMono); // Adapted from https://github.com/highlightjs/highlight.js/blob/master/src/styles/atom-one-light.css

var lightCodeStyles = core.css(_templateObject2 || (_templateObject2 = _taggedTemplateLiteralLoose(["\n  .code-listing {\n    background: #fbfdff;\n    color: #383a42;\n  }\n  .code-comment,\n  .code-quote {\n    color: #a0a1a7;\n    font-style: italic;\n  }\n  .code-doctag,\n  .code-keyword,\n  .code-link,\n  .code-formula {\n    color: #a626a4;\n  }\n  .code-section,\n  .code-name,\n  .code-selector-tag,\n  .code-deletion,\n  .code-subst {\n    color: #e45649;\n  }\n  .code-literal {\n    color: #0184bb;\n  }\n  .code-string,\n  .code-regexp,\n  .code-addition,\n  .code-attribute,\n  .code-meta-string {\n    color: #50a14f;\n  }\n  .code-built_in,\n  .code-class .code-title {\n    color: #c18401;\n  }\n  .code-attr,\n  .code-variable,\n  .code-template-variable,\n  .code-type,\n  .code-selector-class,\n  .code-selector-attr,\n  .code-selector-pseudo,\n  .code-number {\n    color: #986801;\n  }\n  .code-symbol,\n  .code-bullet,\n  .code-meta,\n  .code-selector-id,\n  .code-title {\n    color: #4078f2;\n  }\n  .code-emphasis {\n    font-style: italic;\n  }\n  .code-strong {\n    font-weight: bold;\n  }\n"])));

function Link(_ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return (// eslint-disable-next-line jsx-a11y/anchor-has-content
    core.jsx("a", _extends({}, rest, {
      css: _extends({
        color: '#0076ff',
        textDecoration: 'none',
        ':hover': {
          textDecoration: 'underline'
        }
      }, css)
    }))
  );
}

function AppHeader() {
  return core.jsx("header", {
    css: {
      marginTop: '2rem'
    }
  }, core.jsx("h1", {
    css: {
      textAlign: 'center',
      fontSize: '3rem',
      letterSpacing: '0.05em'
    }
  }, core.jsx("a", {
    href: "/",
    css: {
      color: '#000',
      textDecoration: 'none'
    }
  }, "UNPKG")));
}

function AppNavigation(_ref2) {
  var packageName = _ref2.packageName,
      packageVersion = _ref2.packageVersion,
      availableVersions = _ref2.availableVersions,
      filename = _ref2.filename;

  function handleVersionChange(nextVersion) {
    window.location.href = window.location.href.replace('@' + packageVersion, '@' + nextVersion);
  }

  var breadcrumbs = [];

  if (filename === '/') {
    breadcrumbs.push(packageName);
  } else {
    var url = "/browse/" + packageName + "@" + packageVersion;
    breadcrumbs.push(core.jsx(Link, {
      href: url + "/"
    }, packageName));
    var segments = filename.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
    var lastSegment = segments.pop();
    segments.forEach(function (segment) {
      url += "/" + segment;
      breadcrumbs.push(core.jsx(Link, {
        href: url + "/"
      }, segment));
    });
    breadcrumbs.push(lastSegment);
  }

  return core.jsx("header", {
    css: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      '@media (max-width: 700px)': {
        flexDirection: 'column-reverse',
        alignItems: 'flex-start'
      }
    }
  }, core.jsx("h1", {
    css: {
      fontSize: '1.5rem',
      fontWeight: 'normal',
      flex: 1,
      wordBreak: 'break-all'
    }
  }, core.jsx("nav", null, breadcrumbs.map(function (item, index, array) {
    return core.jsx(React.Fragment, {
      key: index
    }, index !== 0 && core.jsx("span", {
      css: {
        paddingLeft: 5,
        paddingRight: 5
      }
    }, "/"), index === array.length - 1 ? core.jsx("strong", null, item) : item);
  }))), core.jsx(PackageVersionPicker, {
    packageVersion: packageVersion,
    availableVersions: availableVersions,
    onChange: handleVersionChange
  }));
}

function PackageVersionPicker(_ref3) {
  var packageVersion = _ref3.packageVersion,
      availableVersions = _ref3.availableVersions,
      onChange = _ref3.onChange;

  function handleChange(event) {
    if (onChange) onChange(event.target.value);
  }

  return core.jsx("p", {
    css: {
      marginLeft: 20,
      '@media (max-width: 700px)': {
        marginLeft: 0,
        marginBottom: 0
      }
    }
  }, core.jsx("label", null, "Version:", ' ', core.jsx("select", {
    name: "version",
    defaultValue: packageVersion,
    onChange: handleChange,
    css: {
      appearance: 'none',
      cursor: 'pointer',
      padding: '4px 24px 4px 8px',
      fontWeight: 600,
      fontSize: '0.9em',
      color: '#24292e',
      border: '1px solid rgba(27,31,35,.2)',
      borderRadius: 3,
      backgroundColor: '#eff3f6',
      backgroundImage: "url(" + SelectDownArrow + ")",
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'auto 25%',
      ':hover': {
        backgroundColor: '#e6ebf1',
        borderColor: 'rgba(27,31,35,.35)'
      },
      ':active': {
        backgroundColor: '#e9ecef',
        borderColor: 'rgba(27,31,35,.35)',
        boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'
      }
    }
  }, availableVersions.map(function (v) {
    return core.jsx("option", {
      key: v,
      value: v
    }, v);
  }))));
}

function AppContent(_ref4) {
  var packageName = _ref4.packageName,
      packageVersion = _ref4.packageVersion,
      target = _ref4.target;
  return target.type === 'directory' ? core.jsx(FolderViewer, {
    path: target.path,
    details: target.details
  }) : target.type === 'file' ? core.jsx(FileViewer, {
    packageName: packageName,
    packageVersion: packageVersion,
    path: target.path,
    details: target.details
  }) : null;
}

function App(_ref5) {
  var packageName = _ref5.packageName,
      packageVersion = _ref5.packageVersion,
      _ref5$availableVersio = _ref5.availableVersions,
      availableVersions = _ref5$availableVersio === void 0 ? [] : _ref5$availableVersio,
      filename = _ref5.filename,
      target = _ref5.target;
  var maxContentWidth = 940; // TODO: Make this changeable
  return core.jsx(React.Fragment, null, core.jsx(core.Global, {
    styles: globalStyles
  }), core.jsx(core.Global, {
    styles: lightCodeStyles
  }), core.jsx("div", {
    css: {
      flex: '1 0 auto'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '0 20px',
      margin: '0 auto'
    }
  }, core.jsx(AppHeader, null)), core.jsx("div", {
    css: {
      maxWidth:  maxContentWidth,
      padding: '0 20px',
      margin: '0 auto'
    }
  }, core.jsx(AppNavigation, {
    packageName: packageName,
    packageVersion: packageVersion,
    availableVersions: availableVersions,
    filename: filename
  })), core.jsx("div", {
    css: {
      maxWidth:  maxContentWidth,
      padding: '0 20px',
      margin: '0 auto',
      '@media (max-width: 700px)': {
        padding: 0,
        margin: 0
      }
    }
  }, core.jsx(AppContent, {
    packageName: packageName,
    packageVersion: packageVersion,
    target: target
  }))), core.jsx("footer", {
    css: {
      marginTop: '5rem',
      background: 'black',
      color: '#aaa'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '10px 20px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, core.jsx("p", null, core.jsx("span", null, "Build: ", buildId)), core.jsx("p", null, core.jsx("span", null, "\xA9 ", new Date().getFullYear(), " UNPKG")), core.jsx("p", {
    css: {
      fontSize: '1.5rem'
    }
  }, core.jsx("a", {
    href: "https://twitter.com/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(TwitterIcon, null)), core.jsx("a", {
    href: "https://github.com/mjackson/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      },
      marginLeft: '1rem'
    }
  }, core.jsx(GitHubIcon, null))))));
}

if (process.env.NODE_ENV !== 'production') {
  var targetType = PropTypes.shape({
    path: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['directory', 'file']).isRequired,
    details: PropTypes.object.isRequired
  });
  App.propTypes = {
    packageName: PropTypes.string.isRequired,
    packageVersion: PropTypes.string.isRequired,
    availableVersions: PropTypes.arrayOf(PropTypes.string),
    filename: PropTypes.string.isRequired,
    target: targetType.isRequired
  };
}

/**
 * Encodes some data as JSON that may safely be included in HTML.
 */

function encodeJSONForScript(data) {
  return jsesc(data, {
    json: true,
    isScriptContext: true
  });
}

function createHTML$1(code) {
  return {
    __html: code
  };
}
function createScript(script) {
  return React.createElement('script', {
    dangerouslySetInnerHTML: createHTML$1(script)
  });
}

const promiseShim = 'window.Promise || document.write(\'\\x3Cscript src="/es6-promise@4.2.5/dist/es6-promise.min.js">\\x3C/script>\\x3Cscript>ES6Promise.polyfill()\\x3C/script>\')';
const fetchShim = 'window.fetch || document.write(\'\\x3Cscript src="/whatwg-fetch@3.0.0/dist/fetch.umd.js">\\x3C/script>\')';
function MainTemplate({
  title = 'UNPKG',
  description = 'The CDN for everything on npm',
  favicon = '/favicon.ico',
  data,
  content = createHTML$1(''),
  elements = []
}) {
  return React.createElement('html', {
    lang: 'en'
  }, React.createElement('head', null, // Global site tag (gtag.js) - Google Analytics
  React.createElement('script', {
    async: true,
    src: 'https://www.googletagmanager.com/gtag/js?id=UA-140352188-1'
  }), createScript(`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'UA-140352188-1');`), React.createElement('meta', {
    charSet: 'utf-8'
  }), React.createElement('meta', {
    httpEquiv: 'X-UA-Compatible',
    content: 'IE=edge,chrome=1'
  }), description && React.createElement('meta', {
    name: 'description',
    content: description
  }), React.createElement('meta', {
    name: 'viewport',
    content: 'width=device-width,initial-scale=1,maximum-scale=1'
  }), React.createElement('meta', {
    name: 'timestamp',
    content: new Date().toISOString()
  }), favicon && React.createElement('link', {
    rel: 'shortcut icon',
    href: favicon
  }), React.createElement('title', null, title), createScript(promiseShim), createScript(fetchShim), data && createScript(`window.__DATA__ = ${encodeJSONForScript(data)}`)), React.createElement('body', null, React.createElement('div', {
    id: 'root',
    dangerouslySetInnerHTML: content
  }), ...elements));
}

if (process.env.NODE_ENV !== 'production') {
  const htmlType = PropTypes.shape({
    __html: PropTypes.string
  });
  MainTemplate.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    favicon: PropTypes.string,
    data: PropTypes.any,
    content: htmlType,
    elements: PropTypes.arrayOf(PropTypes.node)
  };
}

var entryManifest = [{"browse":[{"format":"iife","globalImports":["react","react-dom","@emotion/core"],"url":"/_client/browse-d9e14aca.js","code":"'use strict';(function(n,y,c){function r(){r=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],e;for(e in c)Object.prototype.hasOwnProperty.call(c,e)&&(a[e]=c[e])}return a};return r.apply(this,arguments)}function O(a,b){if(null==a)return{};var c={},e=Object.keys(a),d;for(d=0;d<e.length;d++){var h=e[d];0<=b.indexOf(h)||(c[h]=a[h])}return c}function P(a,b){b||(b=a.slice(0));a.raw=b;return a}function C(a,b){return b={exports:{}},a(b,b.exports),b.exports}function I(a,b,\nc,e,d){for(var f in a)if(ja(a,f)){try{if(\"function\"!==typeof a[f]){var u=Error((e||\"React class\")+\": \"+c+\" type `\"+f+\"` is invalid; it must be a function, usually from the `prop-types` package, but received `\"+typeof a[f]+\"`.\");u.name=\"Invariant Violation\";throw u;}var m=a[f](b,f,e,c,null,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\")}catch(ka){m=ka}!m||m instanceof Error||J((e||\"React class\")+\": type specification of \"+c+\" `\"+f+\"` is invalid; the type checker function must return `null` or an `Error` but returned a \"+\ntypeof m+\". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).\");if(m instanceof Error&&!(m.message in K)){K[m.message]=!0;var k=d?d():\"\";J(\"Failed \"+c+\" type: \"+m.message+(null!=k?k:\"\"))}}}function D(){return null}function Q(a){var b,f=a.children;a=a.css;return c.jsx(\"div\",{css:r((b={border:\"1px solid #dfe2e5\",borderRadius:3},b[\"@media (max-width: 700px)\"]={borderRightWidth:0,borderLeftWidth:0},\nb),a)},f)}function R(a){var b,f=a.children;a=a.css;return c.jsx(\"div\",{css:r((b={padding:10,background:\"#f6f8fa\",color:\"#424242\",border:\"1px solid #d1d5da\",borderTopLeftRadius:3,borderTopRightRadius:3,margin:\"-1px -1px 0\",display:\"flex\",flexDirection:\"row\",alignItems:\"center\",justifyContent:\"space-between\"},b[\"@media (max-width: 700px)\"]={paddingRight:20,paddingLeft:20},b),a)},f)}function S(a){return a&&a.map(function(a,c){return n.createElement(a.tag,v({key:c},a.attr),S(a.child))})}function A(a){return function(b){return n.createElement(la,\nv({attr:v({},a.attr)},b),S(a.child))}}function la(a){var b=function(b){var c=a.size||b.size||\"1em\";if(b.className)var d=b.className;a.className&&(d=(d?d+\" \":\"\")+a.className);var f=a.attr,u=a.title,m=ma(a,[\"attr\",\"title\"]);return n.createElement(\"svg\",v({stroke:\"currentColor\",fill:\"currentColor\",strokeWidth:\"0\"},b.attr,f,m,{className:d,style:v({color:a.color||b.color},b.style,a.style),height:c,width:c,xmlns:\"http://www.w3.org/2000/svg\"}),u&&n.createElement(\"title\",null,u),a.children)};return void 0!==\nT?n.createElement(T.Consumer,null,function(a){return b(a)}):b(U)}function na(a){return A({tag:\"svg\",attr:{viewBox:\"0 0 12 16\"},child:[{tag:\"path\",attr:{fillRule:\"evenodd\",d:\"M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM5 6.98L3.5 8.5 5 10l-.5 1L2 8.5 4.5 6l.5.98zM7.5 6L10 8.5 7.5 11l-.5-.98L8.5 8.5 7 7l.5-1z\"}}]})(a)}function oa(a){return A({tag:\"svg\",attr:{viewBox:\"0 0 14 16\"},child:[{tag:\"path\",attr:{fillRule:\"evenodd\",d:\"M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z\"}}]})(a)}\nfunction pa(a){return A({tag:\"svg\",attr:{viewBox:\"0 0 12 16\"},child:[{tag:\"path\",attr:{fillRule:\"evenodd\",d:\"M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z\"}}]})(a)}function qa(a){return A({tag:\"svg\",attr:{viewBox:\"0 0 496 512\"},child:[{tag:\"path\",attr:{d:\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"}}]})(a)}\nfunction ra(a){return A({tag:\"svg\",attr:{viewBox:\"0 0 512 512\"},child:[{tag:\"path\",attr:{d:\"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z\"}}]})(a)}\nfunction B(a,b){var f=b.css;b=O(b,[\"css\"]);return c.jsx(a,r({css:r({},f,{verticalAlign:\"text-bottom\"})},b))}function sa(a){return B(pa,a)}function ta(a){return B(na,a)}function ua(a){return B(oa,a)}function va(a){return B(ra,a)}function wa(a){return B(qa,a)}function V(a){var b=a.path,f=a.details,e=Object.keys(f).reduce(function(a,b){var c=a.subdirs,e=a.files;b=f[b];\"directory\"===b.type?c.push(b):\"file\"===b.type&&e.push(b);return a},{subdirs:[],files:[]});a=e.subdirs;e=e.files;a.sort(W(\"path\"));e.sort(W(\"path\"));\nvar d=[];\"/\"!==b&&d.push(c.jsx(\"tr\",{key:\"..\"},c.jsx(\"td\",{css:L}),c.jsx(\"td\",{css:w},c.jsx(\"a\",{title:\"Parent directory\",href:\"../\",css:M},\"..\")),c.jsx(\"td\",{css:w}),c.jsx(\"td\",{css:N})));a.forEach(function(a){a=a.path.substr(1<b.length?b.length+1:1);var e=a+\"/\";d.push(c.jsx(\"tr\",{key:a},c.jsx(\"td\",{css:L},c.jsx(ua,null)),c.jsx(\"td\",{css:w},c.jsx(\"a\",{title:a,href:e,css:M},a)),c.jsx(\"td\",{css:w},\"-\"),c.jsx(\"td\",{css:N},\"-\")))});e.forEach(function(a){var e=a.size,f=a.contentType;a=a.path.substr(1<\nb.length?b.length+1:1);d.push(c.jsx(\"tr\",{key:a},c.jsx(\"td\",{css:L},\"text/plain\"===f||\"text/markdown\"===f?c.jsx(sa,null):c.jsx(ta,null)),c.jsx(\"td\",{css:w},c.jsx(\"a\",{title:a,href:a,css:M},a)),c.jsx(\"td\",{css:w},X(e)),c.jsx(\"td\",{css:N},f)))});var h=[];0<e.length&&h.push(e.length+\" file\"+(1===e.length?\"\":\"s\"));0<a.length&&h.push(a.length+\" folder\"+(1===a.length?\"\":\"s\"));return c.jsx(Q,null,c.jsx(R,null,c.jsx(\"span\",null,h.join(\", \"))),c.jsx(\"table\",{css:{width:\"100%\",borderCollapse:\"collapse\",borderRadius:2,\nbackground:\"#fff\",\"@media (max-width: 700px)\":{\"& th + th + th + th, & td + td + td + td\":{display:\"none\"}},\"& tr:first-of-type td\":{borderTop:0}}},c.jsx(\"thead\",null,c.jsx(\"tr\",null,c.jsx(\"th\",null,c.jsx(E,null,\"Icon\")),c.jsx(\"th\",null,c.jsx(E,null,\"Name\")),c.jsx(\"th\",null,c.jsx(E,null,\"Size\")),c.jsx(\"th\",null,c.jsx(E,null,\"Content Type\")))),c.jsx(\"tbody\",null,d)))}function xa(a){a=a.split(\"/\");return a[a.length-1]}function ya(a){var b=a.uri;return c.jsx(\"div\",{css:{padding:20,textAlign:\"center\"}},\nc.jsx(\"img\",{alt:xa(a.path),src:b}))}function za(a){a=a.highlights.slice(0);var b=a.length&&\"\"===a[a.length-1];b&&a.pop();return c.jsx(\"div\",{className:\"code-listing\",css:{overflowX:\"auto\",overflowY:\"hidden\",paddingTop:5,paddingBottom:5}},c.jsx(\"table\",{css:{border:\"none\",borderCollapse:\"collapse\",borderSpacing:0}},c.jsx(\"tbody\",null,a.map(function(a,b){var e=b+1;return c.jsx(\"tr\",{key:b},c.jsx(\"td\",{id:\"L\"+e,css:{paddingLeft:10,paddingRight:10,color:\"rgba(27,31,35,.3)\",textAlign:\"right\",verticalAlign:\"top\",\nwidth:\"1%\",minWidth:50,userSelect:\"none\"}},c.jsx(\"span\",null,e)),c.jsx(\"td\",{id:\"LC\"+e,css:{paddingLeft:10,paddingRight:10,color:\"#24292e\",whiteSpace:\"pre\"}},c.jsx(\"code\",{dangerouslySetInnerHTML:{__html:a}})))}),!b&&c.jsx(\"tr\",{key:\"no-newline\"},c.jsx(\"td\",{css:{paddingLeft:10,paddingRight:10,color:\"rgba(27,31,35,.3)\",textAlign:\"right\",verticalAlign:\"top\",width:\"1%\",minWidth:50,userSelect:\"none\"}},\"\\\\\"),c.jsx(\"td\",{css:{paddingLeft:10,color:\"rgba(27,31,35,.3)\",userSelect:\"none\"}},\"No newline at end of file\")))))}\nfunction Aa(){return c.jsx(\"div\",{css:{padding:20}},c.jsx(\"p\",{css:{textAlign:\"center\"}},\"No preview available.\"))}function Y(a){var b=a.packageName,f=a.packageVersion,e=a.path;a=a.details;var d=a.highlights,h=a.uri,u=a.language;return c.jsx(Q,null,c.jsx(R,null,c.jsx(\"span\",null,X(a.size)),c.jsx(\"span\",null,u),c.jsx(\"span\",null,c.jsx(\"a\",{href:\"/\"+b+\"@\"+f+e,css:{display:\"inline-block\",marginLeft:8,padding:\"2px 8px\",textDecoration:\"none\",fontWeight:600,fontSize:\"0.9rem\",color:\"#24292e\",backgroundColor:\"#eff3f6\",\nborder:\"1px solid rgba(27,31,35,.2)\",borderRadius:3,\":hover\":{backgroundColor:\"#e6ebf1\",borderColor:\"rgba(27,31,35,.35)\"},\":active\":{backgroundColor:\"#e9ecef\",borderColor:\"rgba(27,31,35,.35)\",boxShadow:\"inset 0 0.15em 0.3em rgba(27,31,35,.15)\"}}},\"View Raw\"))),d?c.jsx(za,{highlights:d}):h?c.jsx(ya,{path:e,uri:h}):c.jsx(Aa,null))}function Z(a){var b=a.css;a=O(a,[\"css\"]);return c.jsx(\"a\",r({},a,{css:r({color:\"#0076ff\",textDecoration:\"none\",\":hover\":{textDecoration:\"underline\"}},b)}))}function Ba(){return c.jsx(\"header\",\n{css:{marginTop:\"2rem\"}},c.jsx(\"h1\",{css:{textAlign:\"center\",fontSize:\"3rem\",letterSpacing:\"0.05em\"}},c.jsx(\"a\",{href:\"/\",css:{color:\"#000\",textDecoration:\"none\"}},\"UNPKG\")))}function Ca(a){var b=a.packageName,f=a.packageVersion,e=a.availableVersions;a=a.filename;var d=[];if(\"/\"===a)d.push(b);else{var h=\"/browse/\"+b+\"@\"+f;d.push(c.jsx(Z,{href:h+\"/\"},b));b=a.replace(/^\\/+/,\"\").replace(/\\/+$/,\"\").split(\"/\");a=b.pop();b.forEach(function(a){h+=\"/\"+a;d.push(c.jsx(Z,{href:h+\"/\"},a))});d.push(a)}return c.jsx(\"header\",\n{css:{display:\"flex\",flexDirection:\"row\",alignItems:\"center\",\"@media (max-width: 700px)\":{flexDirection:\"column-reverse\",alignItems:\"flex-start\"}}},c.jsx(\"h1\",{css:{fontSize:\"1.5rem\",fontWeight:\"normal\",flex:1,wordBreak:\"break-all\"}},c.jsx(\"nav\",null,d.map(function(a,b,e){return c.jsx(n.Fragment,{key:b},0!==b&&c.jsx(\"span\",{css:{paddingLeft:5,paddingRight:5}},\"/\"),b===e.length-1?c.jsx(\"strong\",null,a):a)}))),c.jsx(Da,{packageVersion:f,availableVersions:e,onChange:function(a){window.location.href=\nwindow.location.href.replace(\"@\"+f,\"@\"+a)}}))}function Da(a){var b=a.onChange;return c.jsx(\"p\",{css:{marginLeft:20,\"@media (max-width: 700px)\":{marginLeft:0,marginBottom:0}}},c.jsx(\"label\",null,\"Version:\",\" \",c.jsx(\"select\",{name:\"version\",defaultValue:a.packageVersion,onChange:function(a){b&&b(a.target.value)},css:{appearance:\"none\",cursor:\"pointer\",padding:\"4px 24px 4px 8px\",fontWeight:600,fontSize:\"0.9em\",color:\"#24292e\",border:\"1px solid rgba(27,31,35,.2)\",borderRadius:3,backgroundColor:\"#eff3f6\",\nbackgroundImage:\"url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAAAXNSR0IArs4c6QAAARFJREFUKBVjZAACNS39RhBNKrh17WI9o4quoT3Dn78HSNUMUs/CzOTI/O7Vi4dCYpJ3/jP+92BkYGAlyiBGhm8MjIxJt65e3MQM0vDu9YvLYmISILYZELOBxHABRkaGr0yMzF23r12YDFIDNgDEePv65SEhEXENBkYGFSAXuyGMjF8Z/jOsvX3tYiFIDwgwQSgIaaijnvj/P8M5IO8HsjiY/f//D4b//88A1SQhywG9jQr09PS4v/1mPAeUUPzP8B8cJowMjL+Bqu6xMQmaXL164AuyDgwDQJLa2qYSP//9vARkCoMVMzK8YeVkNbh+9uxzMB+JwGoASF5Vx0jz/98/18BqmZi171w9D2EjaaYKEwAEK00XQLdJuwAAAABJRU5ErkJggg==)\",\nbackgroundPosition:\"right 8px center\",backgroundRepeat:\"no-repeat\",backgroundSize:\"auto 25%\",\":hover\":{backgroundColor:\"#e6ebf1\",borderColor:\"rgba(27,31,35,.35)\"},\":active\":{backgroundColor:\"#e9ecef\",borderColor:\"rgba(27,31,35,.35)\",boxShadow:\"inset 0 0.15em 0.3em rgba(27,31,35,.15)\"}}},a.availableVersions.map(function(a){return c.jsx(\"option\",{key:a,value:a},a)}))))}function Ea(a){var b=a.packageName,f=a.packageVersion;a=a.target;return\"directory\"===a.type?c.jsx(V,{path:a.path,details:a.details}):\n\"file\"===a.type?c.jsx(Y,{packageName:b,packageVersion:f,path:a.path,details:a.details}):null}function aa(a){var b=a.packageName,f=a.packageVersion,e=a.availableVersions;e=void 0===e?[]:e;var d=a.filename;a=a.target;return c.jsx(n.Fragment,null,c.jsx(c.Global,{styles:Fa}),c.jsx(c.Global,{styles:Ga}),c.jsx(\"div\",{css:{flex:\"1 0 auto\"}},c.jsx(\"div\",{css:{maxWidth:940,padding:\"0 20px\",margin:\"0 auto\"}},c.jsx(Ba,null)),c.jsx(\"div\",{css:{maxWidth:940,padding:\"0 20px\",margin:\"0 auto\"}},c.jsx(Ca,{packageName:b,\npackageVersion:f,availableVersions:e,filename:d})),c.jsx(\"div\",{css:{maxWidth:940,padding:\"0 20px\",margin:\"0 auto\",\"@media (max-width: 700px)\":{padding:0,margin:0}}},c.jsx(Ea,{packageName:b,packageVersion:f,target:a}))),c.jsx(\"footer\",{css:{marginTop:\"5rem\",background:\"black\",color:\"#aaa\"}},c.jsx(\"div\",{css:{maxWidth:940,padding:\"10px 20px\",margin:\"0 auto\",display:\"flex\",flexDirection:\"row\",alignItems:\"center\",justifyContent:\"space-between\"}},c.jsx(\"p\",null,c.jsx(\"span\",null,\"Build: \",\"fd447fa\")),\nc.jsx(\"p\",null,c.jsx(\"span\",null,\"\\u00a9 \",(new Date).getFullYear(),\" UNPKG\")),c.jsx(\"p\",{css:{fontSize:\"1.5rem\"}},c.jsx(\"a\",{href:\"https://twitter.com/unpkg\",css:{color:\"#aaa\",display:\"inline-block\",\":hover\":{color:\"white\"}}},c.jsx(va,null)),c.jsx(\"a\",{href:\"https://github.com/mjackson/unpkg\",css:{color:\"#aaa\",display:\"inline-block\",\":hover\":{color:\"white\"},marginLeft:\"1rem\"}},c.jsx(wa,null))))))}var ba=\"default\"in n?n[\"default\"]:n;y=y&&Object.prototype.hasOwnProperty.call(y,\"default\")?y[\"default\"]:\ny;var Ha=\"undefined\"!==typeof globalThis?globalThis:\"undefined\"!==typeof window?window:\"undefined\"!==typeof global?global:\"undefined\"!==typeof self?self:{},La=C(function(a,b){(function(){function a(a){if(\"object\"===typeof a&&null!==a){var b=a.$$typeof;switch(b){case h:switch(a=a.type,a){case l:case q:case m:case n:case k:case x:return a;default:switch(a=a&&a.$$typeof,a){case g:case t:case F:case G:case p:return a;default:return b}}case u:return b}}}function c(b){return a(b)===q}var d=\"function\"===\ntypeof Symbol&&Symbol.for,h=d?Symbol.for(\"react.element\"):60103,u=d?Symbol.for(\"react.portal\"):60106,m=d?Symbol.for(\"react.fragment\"):60107,k=d?Symbol.for(\"react.strict_mode\"):60108,n=d?Symbol.for(\"react.profiler\"):60114,p=d?Symbol.for(\"react.provider\"):60109,g=d?Symbol.for(\"react.context\"):60110,l=d?Symbol.for(\"react.async_mode\"):60111,q=d?Symbol.for(\"react.concurrent_mode\"):60111,t=d?Symbol.for(\"react.forward_ref\"):60112,x=d?Symbol.for(\"react.suspense\"):60113,Ia=d?Symbol.for(\"react.suspense_list\"):\n60120,G=d?Symbol.for(\"react.memo\"):60115,F=d?Symbol.for(\"react.lazy\"):60116,Ja=d?Symbol.for(\"react.block\"):60121,Ka=d?Symbol.for(\"react.fundamental\"):60117,r=d?Symbol.for(\"react.responder\"):60118,w=d?Symbol.for(\"react.scope\"):60119,v=!1;b.AsyncMode=l;b.ConcurrentMode=q;b.ContextConsumer=g;b.ContextProvider=p;b.Element=h;b.ForwardRef=t;b.Fragment=m;b.Lazy=F;b.Memo=G;b.Portal=u;b.Profiler=n;b.StrictMode=k;b.Suspense=x;b.isAsyncMode=function(b){v||(v=!0,console.warn(\"The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.\"));\nreturn c(b)||a(b)===l};b.isConcurrentMode=c;b.isContextConsumer=function(b){return a(b)===g};b.isContextProvider=function(b){return a(b)===p};b.isElement=function(a){return\"object\"===typeof a&&null!==a&&a.$$typeof===h};b.isForwardRef=function(b){return a(b)===t};b.isFragment=function(b){return a(b)===m};b.isLazy=function(b){return a(b)===F};b.isMemo=function(b){return a(b)===G};b.isPortal=function(b){return a(b)===u};b.isProfiler=function(b){return a(b)===n};b.isStrictMode=function(b){return a(b)===\nk};b.isSuspense=function(b){return a(b)===x};b.isValidElementType=function(a){return\"string\"===typeof a||\"function\"===typeof a||a===m||a===q||a===n||a===k||a===x||a===Ia||\"object\"===typeof a&&null!==a&&(a.$$typeof===F||a.$$typeof===G||a.$$typeof===p||a.$$typeof===g||a.$$typeof===t||a.$$typeof===Ka||a.$$typeof===r||a.$$typeof===w||a.$$typeof===Ja)};b.typeOf=a})()}),ca=C(function(a){a.exports=La}),da=Object.getOwnPropertySymbols,Ma=Object.prototype.hasOwnProperty,Na=Object.prototype.propertyIsEnumerable,\nOa=function(){try{if(!Object.assign)return!1;var a=new String(\"abc\");a[5]=\"de\";if(\"5\"===Object.getOwnPropertyNames(a)[0])return!1;var b={};for(a=0;10>a;a++)b[\"_\"+String.fromCharCode(a)]=a;if(\"0123456789\"!==Object.getOwnPropertyNames(b).map(function(a){return b[a]}).join(\"\"))return!1;var c={};\"abcdefghijklmnopqrst\".split(\"\").forEach(function(a){c[a]=a});return\"abcdefghijklmnopqrst\"!==Object.keys(Object.assign({},c)).join(\"\")?!1:!0}catch(e){return!1}}()?Object.assign:function(a,b){if(null===a||void 0===\na)throw new TypeError(\"Object.assign cannot be called with null or undefined\");var c=Object(a);for(var e,d=1;d<arguments.length;d++){var h=Object(arguments[d]);for(var k in h)Ma.call(h,k)&&(c[k]=h[k]);if(da){e=da(h);for(var m=0;m<e.length;m++)Na.call(h,e[m])&&(c[e[m]]=h[e[m]])}}return c},J=function(){},K={},ja=Function.call.bind(Object.prototype.hasOwnProperty);J=function(a){a=\"Warning: \"+a;\"undefined\"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};I.resetWarningCache=function(){K=\n{}};var Pa=Function.call.bind(Object.prototype.hasOwnProperty),z=function(){};z=function(a){a=\"Warning: \"+a;\"undefined\"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};var Qa=function(a,b){function c(a,b){return a===b?0!==a||1/a===1/b:a!==a&&b!==b}function e(a){this.message=a;this.stack=\"\"}function d(a){function l(l,q,g,t,f,h,x){t=t||\"<<anonymous>>\";h=h||g;if(\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"!==x){if(b)throw l=Error(\"Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types\"),\nl.name=\"Invariant Violation\",l;\"undefined\"!==typeof console&&(x=t+\":\"+g,!c[x]&&3>d&&(z(\"You are manually calling a React.PropTypes validation function for the `\"+h+\"` prop on `\"+t+\"`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.\"),c[x]=!0,d++))}return null==q[g]?l?null===q[g]?new e(\"The \"+f+\" `\"+h+\"` is marked as required \"+(\"in `\"+t+\n\"`, but its value is `null`.\")):new e(\"The \"+f+\" `\"+h+\"` is marked as required in \"+(\"`\"+t+\"`, but its value is `undefined`.\")):null:a(q,g,t,f,h)}var c={},d=0,g=l.bind(null,!1);g.isRequired=l.bind(null,!0);return g}function h(a){return d(function(b,l,c,d,g,f){b=b[l];return m(b)!==a?(b=n(b),new e(\"Invalid \"+d+\" `\"+g+\"` of type \"+(\"`\"+b+\"` supplied to `\"+c+\"`, expected \")+(\"`\"+a+\"`.\"))):null})}function k(b){switch(typeof b){case \"number\":case \"string\":case \"undefined\":return!0;case \"boolean\":return!b;\ncase \"object\":if(Array.isArray(b))return b.every(k);if(null===b||a(b))return!0;var c=b&&(p&&b[p]||b[\"@@iterator\"]);var l=\"function\"===typeof c?c:void 0;if(l)if(c=l.call(b),l!==b.entries)for(;!(b=c.next()).done;){if(!k(b.value))return!1}else for(;!(b=c.next()).done;){if((b=b.value)&&!k(b[1]))return!1}else return!1;return!0;default:return!1}}function m(a){var b=typeof a;return Array.isArray(a)?\"array\":a instanceof RegExp?\"object\":\"symbol\"===b||a&&(\"Symbol\"===a[\"@@toStringTag\"]||\"function\"===typeof Symbol&&\na instanceof Symbol)?\"symbol\":b}function n(a){if(\"undefined\"===typeof a||null===a)return\"\"+a;var b=m(a);if(\"object\"===b){if(a instanceof Date)return\"date\";if(a instanceof RegExp)return\"regexp\"}return b}function r(a){a=n(a);switch(a){case \"array\":case \"object\":return\"an \"+a;case \"boolean\":case \"date\":case \"regexp\":return\"a \"+a;default:return a}}var p=\"function\"===typeof Symbol&&Symbol.iterator,g={array:h(\"array\"),bool:h(\"boolean\"),func:h(\"function\"),number:h(\"number\"),object:h(\"object\"),string:h(\"string\"),\nsymbol:h(\"symbol\"),any:d(D),arrayOf:function(a){return d(function(b,c,l,d,g){if(\"function\"!==typeof a)return new e(\"Property `\"+g+\"` of component `\"+l+\"` has invalid PropType notation inside arrayOf.\");b=b[c];if(!Array.isArray(b))return b=m(b),new e(\"Invalid \"+d+\" `\"+g+\"` of type \"+(\"`\"+b+\"` supplied to `\"+l+\"`, expected an array.\"));for(c=0;c<b.length;c++){var q=a(b,c,l,d,g+\"[\"+c+\"]\",\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\");if(q instanceof Error)return q}return null})},element:function(){return d(function(b,\nc,d,g,f){b=b[c];return a(b)?null:(b=m(b),new e(\"Invalid \"+g+\" `\"+f+\"` of type \"+(\"`\"+b+\"` supplied to `\"+d+\"`, expected a single ReactElement.\")))})}(),elementType:function(){return d(function(a,b,c,d,g){a=a[b];return ca.isValidElementType(a)?null:(a=m(a),new e(\"Invalid \"+d+\" `\"+g+\"` of type \"+(\"`\"+a+\"` supplied to `\"+c+\"`, expected a single ReactElement type.\")))})}(),instanceOf:function(a){return d(function(b,c,d,l,g){if(!(b[c]instanceof a)){var q=a.name||\"<<anonymous>>\";b=b[c];b=b.constructor&&\nb.constructor.name?b.constructor.name:\"<<anonymous>>\";return new e(\"Invalid \"+l+\" `\"+g+\"` of type \"+(\"`\"+b+\"` supplied to `\"+d+\"`, expected \")+(\"instance of `\"+q+\"`.\"))}return null})},node:function(){return d(function(a,b,c,d,g){return k(a[b])?null:new e(\"Invalid \"+d+\" `\"+g+\"` supplied to \"+(\"`\"+c+\"`, expected a ReactNode.\"))})}(),objectOf:function(a){return d(function(b,c,d,g,l){if(\"function\"!==typeof a)return new e(\"Property `\"+l+\"` of component `\"+d+\"` has invalid PropType notation inside objectOf.\");\nb=b[c];c=m(b);if(\"object\"!==c)return new e(\"Invalid \"+g+\" `\"+l+\"` of type \"+(\"`\"+c+\"` supplied to `\"+d+\"`, expected an object.\"));for(var f in b)if(Pa(b,f)&&(c=a(b,f,d,g,l+\".\"+f,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"),c instanceof Error))return c;return null})},oneOf:function(a){return Array.isArray(a)?d(function(b,d,g,l,f){b=b[d];for(d=0;d<a.length;d++)if(c(b,a[d]))return null;d=JSON.stringify(a,function(a,b){return\"symbol\"===n(b)?String(b):b});return new e(\"Invalid \"+l+\" `\"+f+\"` of value `\"+\nString(b)+\"` \"+(\"supplied to `\"+g+\"`, expected one of \"+d+\".\"))}):(1<arguments.length?z(\"Invalid arguments supplied to oneOf, expected an array, got \"+arguments.length+\" arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).\"):z(\"Invalid argument supplied to oneOf, expected an array.\"),D)},oneOfType:function(a){if(!Array.isArray(a))return z(\"Invalid argument supplied to oneOfType, expected an instance of array.\"),D;for(var b=0;b<a.length;b++){var c=a[b];if(\"function\"!==\ntypeof c)return z(\"Invalid argument supplied to oneOfType. Expected an array of check functions, but received \"+r(c)+\" at index \"+b+\".\"),D}return d(function(b,c,d,g,l){for(var f=0;f<a.length;f++)if(null==(0,a[f])(b,c,d,g,l,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return null;return new e(\"Invalid \"+g+\" `\"+l+\"` supplied to \"+(\"`\"+d+\"`.\"))})},shape:function(a){return d(function(b,c,d,g,l){b=b[c];c=m(b);if(\"object\"!==c)return new e(\"Invalid \"+g+\" `\"+l+\"` of type `\"+c+\"` \"+(\"supplied to `\"+d+\"`, expected `object`.\"));\nfor(var f in a)if(c=a[f])if(c=c(b,f,d,g,l+\".\"+f,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return c;return null})},exact:function(a){return d(function(b,c,d,g,l){var f=b[c],h=m(f);if(\"object\"!==h)return new e(\"Invalid \"+g+\" `\"+l+\"` of type `\"+h+\"` \"+(\"supplied to `\"+d+\"`, expected `object`.\"));h=Oa({},b[c],a);for(var q in h){h=a[q];if(!h)return new e(\"Invalid \"+g+\" `\"+l+\"` key `\"+q+\"` supplied to `\"+d+\"`.\\nBad object: \"+JSON.stringify(b[c],null,\"  \")+\"\\nValid keys: \"+JSON.stringify(Object.keys(a),\nnull,\"  \"));if(h=h(f,q,d,g,l+\".\"+q,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return h}return null})}};e.prototype=Error.prototype;g.checkPropTypes=I;g.resetWarningCache=I.resetWarningCache;return g.PropTypes=g},k=C(function(a){a.exports=Qa(ca.isElement,!0)}),Ra=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],e;for(e in c)Object.prototype.hasOwnProperty.call(c,e)&&(a[e]=c[e])}return a},Sa={border:0,clip:\"rect(0 0 0 0)\",height:\"1px\",width:\"1px\",margin:\"-1px\",\npadding:0,overflow:\"hidden\",position:\"absolute\"},E=function(a){return ba.createElement(\"div\",Ra({style:Sa},a))},ea=C(function(a){(function(b,c){a.exports=c()})(Ha,function(){function a(a){if(!a)return!0;if(!d(a)||0!==a.length)for(var b in a)if(r.call(a,b))return!1;return!0}function c(a){return\"number\"===typeof a||\"[object Number]\"===n.call(a)}function e(a){return\"string\"===typeof a||\"[object String]\"===n.call(a)}function d(a){return\"object\"===typeof a&&\"number\"===typeof a.length&&\"[object Array]\"===\nn.call(a)}function h(a){var b=parseInt(a);return b.toString()===a?b:a}function k(b,d,f,m){c(d)&&(d=[d]);if(a(d))return b;if(e(d))return k(b,d.split(\".\"),f,m);var g=h(d[0]);if(1===d.length)return d=b[g],void 0!==d&&m||(b[g]=f),d;void 0===b[g]&&(c(g)?b[g]=[]:b[g]={});return k(b[g],d.slice(1),f,m)}function m(b,f){c(f)&&(f=[f]);if(!a(b)){if(a(f))return b;if(e(f))return m(b,f.split(\".\"));var g=h(f[0]),l=b[g];if(1===f.length)void 0!==l&&(d(b)?b.splice(g,1):delete b[g]);else if(void 0!==b[g])return m(b[g],\nf.slice(1));return b}}var n=Object.prototype.toString,r=Object.prototype.hasOwnProperty,p={ensureExists:function(a,b,c){return k(a,b,c,!0)},set:function(a,b,c,d){return k(a,b,c,d)},insert:function(a,b,c,e){var f=p.get(a,b);e=~~e;d(f)||(f=[],p.set(a,b,f));f.splice(e,0,c)},empty:function(b,f){if(a(f))return b;if(!a(b)){var g,h;if(!(g=p.get(b,f)))return b;if(e(g))return p.set(b,f,\"\");if(\"boolean\"===typeof g||\"[object Boolean]\"===n.call(g))return p.set(b,f,!1);if(c(g))return p.set(b,f,0);if(d(g))g.length=\n0;else if(\"object\"===typeof g&&\"[object Object]\"===n.call(g))for(h in g)r.call(g,h)&&delete g[h];else return p.set(b,f,null)}},push:function(a,b){var c=p.get(a,b);d(c)||(c=[],p.set(a,b,c));c.push.apply(c,Array.prototype.slice.call(arguments,2))},coalesce:function(a,b,c){for(var d,e=0,f=b.length;e<f;e++)if(void 0!==(d=p.get(a,b[e])))return d;return c},get:function(b,d,f){c(d)&&(d=[d]);if(a(d))return b;if(a(b))return f;if(e(d))return p.get(b,d.split(\".\"),f);var g=h(d[0]);return 1===d.length?void 0===\nb[g]?f:b[g]:p.get(b[g],d.slice(1),f)},del:function(a,b){return m(a,b)}};return p})});var fa=function(a){return function(b){return typeof b===a}};var Ta=function(a,b){var c=1,e=b||function(a,b){return b};\"-\"===a[0]&&(c=-1,a=a.substr(1));return function(b,f){var d;b=e(a,ea.get(b,a));f=e(a,ea.get(f,a));b<f&&(d=-1);b>f&&(d=1);b===f&&(d=0);return d*c}};var W=function(){var a=Array.prototype.slice.call(arguments),b=a.filter(fa(\"string\")),c=a.filter(fa(\"function\"))[0];return function(a,d){for(var f=b.length,\ne=0,k=0;0===e&&k<f;)e=Ta(b[k],c)(a,d),k++;return e}};let Ua=\"B kB MB GB TB PB EB ZB YB\".split(\" \"),Va=\"B kiB MiB GiB TiB PiB EiB ZiB YiB\".split(\" \"),Wa=\"b kbit Mbit Gbit Tbit Pbit Ebit Zbit Ybit\".split(\" \"),Xa=\"b kibit Mibit Gibit Tibit Pibit Eibit Zibit Yibit\".split(\" \"),ha=(a,b,c)=>{let e=a;if(\"string\"===typeof b||Array.isArray(b))e=a.toLocaleString(b,c);else if(!0===b||void 0!==c)e=a.toLocaleString(void 0,c);return e};var X=(a,b)=>{if(!Number.isFinite(a))throw new TypeError(`Expected a finite number, got ${typeof a}: ${a}`);\nb=Object.assign({bits:!1,binary:!1},b);let c=b.bits?b.binary?Xa:Wa:b.binary?Va:Ua;if(b.signed&&0===a)return` 0 ${c[0]}`;var e=0>a;let d=e?\"-\":b.signed?\"+\":\"\";e&&(a=-a);let h;void 0!==b.minimumFractionDigits&&(h={minimumFractionDigits:b.minimumFractionDigits});void 0!==b.maximumFractionDigits&&(h=Object.assign({maximumFractionDigits:b.maximumFractionDigits},h));if(1>a)return a=ha(a,b.locale,h),d+a+\" \"+c[0];e=Math.min(Math.floor(b.binary?Math.log(a)/Math.log(1024):Math.log10(a)/3),c.length-1);a/=Math.pow(b.binary?\n1024:1E3,e);h||(a=a.toPrecision(3));a=ha(Number(a),b.locale,h);return d+a+\" \"+c[e]},U={color:void 0,size:void 0,className:void 0,style:void 0,attr:void 0},T=n.createContext&&n.createContext(U),v=window&&window.__assign||function(){v=Object.assign||function(a){for(var b,c=1,e=arguments.length;c<e;c++){b=arguments[c];for(var d in b)Object.prototype.hasOwnProperty.call(b,d)&&(a[d]=b[d])}return a};return v.apply(this,arguments)},ma=window&&window.__rest||function(a,b){var c={},e;for(e in a)Object.prototype.hasOwnProperty.call(a,\ne)&&0>b.indexOf(e)&&(c[e]=a[e]);if(null!=a&&\"function\"===typeof Object.getOwnPropertySymbols){var d=0;for(e=Object.getOwnPropertySymbols(a);d<e.length;d++)0>b.indexOf(e[d])&&(c[e[d]]=a[e[d]])}return c},M={color:\"#0076ff\",textDecoration:\"none\",\":hover\":{textDecoration:\"underline\"}},w={paddingTop:6,paddingRight:3,paddingBottom:6,paddingLeft:3,borderTop:\"1px solid #eaecef\"},L=r({},w,{color:\"#424242\",width:17,paddingRight:2,paddingLeft:10,\"@media (max-width: 700px)\":{paddingLeft:20}}),N=r({},w,{textAlign:\"right\",\npaddingRight:10,\"@media (max-width: 700px)\":{paddingRight:20}});V.propTypes={path:k.string.isRequired,details:k.objectOf(k.shape({path:k.string.isRequired,type:k.oneOf([\"directory\",\"file\"]).isRequired,contentType:k.string,integrity:k.string,size:k.number})).isRequired};Y.propTypes={path:k.string.isRequired,details:k.shape({contentType:k.string.isRequired,highlights:k.arrayOf(k.string),uri:k.string,integrity:k.string.isRequired,language:k.string.isRequired,size:k.number.isRequired}).isRequired};var H,\nia,Fa=c.css(H||(H=P([\"\\n  html {\\n    box-sizing: border-box;\\n  }\\n  *,\\n  *:before,\\n  *:after {\\n    box-sizing: inherit;\\n  }\\n\\n  html,\\n  body,\\n  #root {\\n    height: 100%;\\n    margin: 0;\\n  }\\n\\n  body {\\n    \",\"\\n    font-size: 16px;\\n    line-height: 1.5;\\n    overflow-wrap: break-word;\\n    background: white;\\n    color: black;\\n  }\\n\\n  code {\\n    \",\"\\n  }\\n\\n  th,\\n  td {\\n    padding: 0;\\n  }\\n\\n  select {\\n    font-size: inherit;\\n  }\\n\\n  #root {\\n    display: flex;\\n    flex-direction: column;\\n  }\\n\"])),\n'\\nfont-family: -apple-system,\\n  BlinkMacSystemFont,\\n  \"Segoe UI\",\\n  \"Roboto\",\\n  \"Oxygen\",\\n  \"Ubuntu\",\\n  \"Cantarell\",\\n  \"Fira Sans\",\\n  \"Droid Sans\",\\n  \"Helvetica Neue\",\\n  sans-serif;\\n',\"\\nfont-family: Menlo,\\n  Monaco,\\n  Lucida Console,\\n  Liberation Mono,\\n  DejaVu Sans Mono,\\n  Bitstream Vera Sans Mono,\\n  Courier New,\\n  monospace;\\n\"),Ga=c.css(ia||(ia=P([\"\\n  .code-listing {\\n    background: #fbfdff;\\n    color: #383a42;\\n  }\\n  .code-comment,\\n  .code-quote {\\n    color: #a0a1a7;\\n    font-style: italic;\\n  }\\n  .code-doctag,\\n  .code-keyword,\\n  .code-link,\\n  .code-formula {\\n    color: #a626a4;\\n  }\\n  .code-section,\\n  .code-name,\\n  .code-selector-tag,\\n  .code-deletion,\\n  .code-subst {\\n    color: #e45649;\\n  }\\n  .code-literal {\\n    color: #0184bb;\\n  }\\n  .code-string,\\n  .code-regexp,\\n  .code-addition,\\n  .code-attribute,\\n  .code-meta-string {\\n    color: #50a14f;\\n  }\\n  .code-built_in,\\n  .code-class .code-title {\\n    color: #c18401;\\n  }\\n  .code-attr,\\n  .code-variable,\\n  .code-template-variable,\\n  .code-type,\\n  .code-selector-class,\\n  .code-selector-attr,\\n  .code-selector-pseudo,\\n  .code-number {\\n    color: #986801;\\n  }\\n  .code-symbol,\\n  .code-bullet,\\n  .code-meta,\\n  .code-selector-id,\\n  .code-title {\\n    color: #4078f2;\\n  }\\n  .code-emphasis {\\n    font-style: italic;\\n  }\\n  .code-strong {\\n    font-weight: bold;\\n  }\\n\"])));\nH=k.shape({path:k.string.isRequired,type:k.oneOf([\"directory\",\"file\"]).isRequired,details:k.object.isRequired});aa.propTypes={packageName:k.string.isRequired,packageVersion:k.string.isRequired,availableVersions:k.arrayOf(k.string),filename:k.string.isRequired,target:H.isRequired};y.hydrate(ba.createElement(aa,window.__DATA__||{}),document.getElementById(\"root\"))})(React,ReactDOM,emotionCore);\n"}]},{"main":[{"format":"iife","globalImports":["react","react-dom","@emotion/core"],"url":"/_client/main-681cce0c.js","code":"'use strict';(function(n,w,c){function x(){x=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var e=arguments[b],d;for(d in e)Object.prototype.hasOwnProperty.call(e,d)&&(a[d]=e[d])}return a};return x.apply(this,arguments)}function ia(a,b){b||(b=a.slice(0));a.raw=b;return a}function E(a,b){return b={exports:{}},a(b,b.exports),b.exports}function F(a,b,e,d,c){for(var f in a)if(ja(a,f)){try{if(\"function\"!==typeof a[f]){var h=Error((d||\"React class\")+\": \"+e+\" type `\"+f+\"` is invalid; it must be a function, usually from the `prop-types` package, but received `\"+\ntypeof a[f]+\"`.\");h.name=\"Invariant Violation\";throw h;}var l=a[f](b,f,d,e,null,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\")}catch(q){l=q}!l||l instanceof Error||G((d||\"React class\")+\": type specification of \"+e+\" `\"+f+\"` is invalid; the type checker function must return `null` or an `Error` but returned a \"+typeof l+\". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).\");if(l instanceof Error&&\n!(l.message in H)){H[l.message]=!0;var k=c?c():\"\";G(\"Failed \"+e+\" type: \"+l.message+(null!=k?k:\"\"))}}}function z(){return null}function ka(a,b){if(null===b)return null;var e;if(0===a.length)return a=new Date(0),a.setUTCFullYear(b),a;if(e=la.exec(a)){a=new Date(0);var d=parseInt(e[1],10)-1;a.setUTCFullYear(b,d);return a}return(e=ma.exec(a))?(a=new Date(0),e=parseInt(e[1],10),a.setUTCFullYear(b,0,e),a):(e=na.exec(a))?(a=new Date(0),d=parseInt(e[1],10)-1,e=parseInt(e[2],10),a.setUTCFullYear(b,d,e),a):\n(e=oa.exec(a))?(a=parseInt(e[1],10)-1,M(b,a)):(e=pa.exec(a))?(a=parseInt(e[1],10)-1,e=parseInt(e[2],10)-1,M(b,a,e)):null}function qa(a){var b;if(b=ra.exec(a))return a=parseFloat(b[1].replace(\",\",\".\")),a%24*36E5;if(b=sa.exec(a)){a=parseInt(b[1],10);var e=parseFloat(b[2].replace(\",\",\".\"));return a%24*36E5+6E4*e}return(b=ta.exec(a))?(a=parseInt(b[1],10),e=parseInt(b[2],10),b=parseFloat(b[3].replace(\",\",\".\")),a%24*36E5+6E4*e+1E3*b):null}function ua(a){var b;return(b=va.exec(a))?0:(b=wa.exec(a))?(a=60*\nparseInt(b[2],10),\"+\"===b[1]?-a:a):(b=xa.exec(a))?(a=60*parseInt(b[2],10)+parseInt(b[3],10),\"+\"===b[1]?-a:a):0}function M(a,b,e){b=b||0;e=e||0;var d=new Date(0);d.setUTCFullYear(a,0,4);a=d.getUTCDay()||7;b=7*b+e+1-a;d.setUTCDate(d.getUTCDate()+b);return d}function ya(a){var b=a%100;if(20<b||10>b)switch(b%10){case 1:return a+\"st\";case 2:return a+\"nd\";case 3:return a+\"rd\"}return a+\"th\"}function za(a,b,e){var d=a.match(e),c=d.length;for(a=0;a<c;a++)e=b[d[a]]||I[d[a]],d[a]=e?e:Aa(d[a]);return function(a){for(var b=\n\"\",e=0;e<c;e++)b=d[e]instanceof Function?b+d[e](a,I):b+d[e];return b}}function Aa(a){return a.match(/\\[[\\s\\S]/)?a.replace(/^\\[|]$/g,\"\"):a.replace(/\\\\/g,\"\")}function N(a,b){b=b||\"\";var e=Math.abs(a),d=e%60;return(0<a?\"-\":\"+\")+m(Math.floor(e/60),2)+b+m(d,2)}function m(a,b){for(a=Math.abs(a).toString();a.length<b;)a=\"0\"+a;return a}function J(a){a=String(a).split(\"\");for(var b=[];a.length;)b.unshift(a.splice(-3).join(\"\"));return b.join(\",\")}function Ba(a,b){void 0===b&&(b=1);return(100*a).toPrecision(b+\n2)}function O(a){return a&&a.map(function(a,e){return n.createElement(a.tag,u({key:e},a.attr),O(a.child))})}function P(a){return function(b){return n.createElement(Ca,u({attr:u({},a.attr)},b),O(a.child))}}function Ca(a){var b=function(b){var e=a.size||b.size||\"1em\";if(b.className)var c=b.className;a.className&&(c=(c?c+\" \":\"\")+a.className);var g=a.attr,h=a.title,l=Da(a,[\"attr\",\"title\"]);return n.createElement(\"svg\",u({stroke:\"currentColor\",fill:\"currentColor\",strokeWidth:\"0\"},b.attr,g,l,{className:c,\nstyle:u({color:a.color||b.color},b.style,a.style),height:e,width:e,xmlns:\"http://www.w3.org/2000/svg\"}),h&&n.createElement(\"title\",null,h),a.children)};return void 0!==Q?n.createElement(Q.Consumer,null,function(a){return b(a)}):b(R)}function Ea(a){return P({tag:\"svg\",attr:{viewBox:\"0 0 496 512\"},child:[{tag:\"path\",attr:{d:\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"}}]})(a)}\nfunction Fa(a){return P({tag:\"svg\",attr:{viewBox:\"0 0 512 512\"},child:[{tag:\"path\",attr:{d:\"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z\"}}]})(a)}\nfunction S(a,b){var e=b.css;var d=[\"css\"];if(null==b)b={};else{var f={},g=Object.keys(b),h;for(h=0;h<g.length;h++){var l=g[h];0<=d.indexOf(l)||(f[l]=b[l])}b=f}return c.jsx(a,x({css:x({},e,{verticalAlign:\"text-bottom\"})},b))}function Ga(a){return S(Fa,a)}function Ha(a){return S(Ea,a)}function k(a){return c.jsx(\"a\",x({},a,{css:{color:\"#0076ff\",textDecoration:\"none\",\":hover\":{textDecoration:\"underline\"}}}))}function T(a){return c.jsx(\"div\",{css:{textAlign:\"center\",flex:\"1\"}},a.children)}function U(a){return c.jsx(\"img\",\nx({},a,{css:{maxWidth:\"90%\"}}))}function Ia(a){a=a.data.totals;var b=t(a.since),e=t(a.until);return c.jsx(\"p\",null,\"From \",c.jsx(\"strong\",null,V(b,\"MMM D\")),\" to\",\" \",c.jsx(\"strong\",null,V(e,\"MMM D\")),\" unpkg served\",\" \",c.jsx(\"strong\",null,J(a.requests.all)),\" requests and a total of \",c.jsx(\"strong\",null,W(a.bandwidth.all)),\" of data to\",\" \",c.jsx(\"strong\",null,J(a.uniques.all)),\" unique visitors,\",\" \",c.jsx(\"strong\",null,Ba(a.requests.cached/a.requests.all,2),\"%\"),\" \",\"of which were served from the cache.\")}\nfunction X(){var a=n.useState(\"object\"===typeof window&&window.localStorage&&window.localStorage.savedStats?JSON.parse(window.localStorage.savedStats):null),b=a[0],e=a[1];a=!(!b||b.error);var d=JSON.stringify(b);n.useEffect(function(){window.localStorage.savedStats=d},[d]);n.useEffect(function(){fetch(\"/api/stats?period=last-month\").then(function(a){return a.json()}).then(e)},[]);return c.jsx(n.Fragment,null,c.jsx(c.Global,{styles:Ja}),c.jsx(\"div\",{css:{maxWidth:740,margin:\"0 auto\"}},c.jsx(\"div\",\n{css:{padding:\"0 20px\"}},c.jsx(\"header\",null,c.jsx(\"h1\",{css:{textAlign:\"center\",fontSize:\"4.5em\",letterSpacing:\"0.05em\",\"@media (min-width: 700px)\":{marginTop:\"1.5em\"}}},\"UNPKG\"),c.jsx(\"p\",null,\"unpkg is a fast, global content delivery network for everything on\",\" \",c.jsx(k,{href:\"https://www.npmjs.com/\"},\"npm\"),\". Use it to quickly and easily load any file from any package using a URL like:\"),c.jsx(\"div\",{css:{textAlign:\"center\",backgroundColor:\"#eee\",margin:\"2em 0\",padding:\"5px 0\"}},\"unpkg.com/:package@:version/:file\"),\na&&c.jsx(Ia,{data:b})),c.jsx(\"h3\",{css:{fontSize:\"1.6em\"},id:\"examples\"},\"Examples\"),c.jsx(\"p\",null,\"Using a fixed version:\"),c.jsx(\"ul\",null,c.jsx(\"li\",null,c.jsx(k,{href:\"/react@16.7.0/umd/react.production.min.js\"},\"unpkg.com/react@16.7.0/umd/react.production.min.js\")),c.jsx(\"li\",null,c.jsx(k,{href:\"/react-dom@16.7.0/umd/react-dom.production.min.js\"},\"unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js\"))),c.jsx(\"p\",null,\"You may also use a\",\" \",c.jsx(k,{href:\"https://docs.npmjs.com/misc/semver\"},\n\"semver range\"),\" \",\"or a \",c.jsx(k,{href:\"https://docs.npmjs.com/cli/dist-tag\"},\"tag\"),\" \",\"instead of a fixed version number, or omit the version/tag entirely to use the \",c.jsx(\"code\",null,\"latest\"),\" tag.\"),c.jsx(\"ul\",null,c.jsx(\"li\",null,c.jsx(k,{href:\"/react@^16/umd/react.production.min.js\"},\"unpkg.com/react@^16/umd/react.production.min.js\")),c.jsx(\"li\",null,c.jsx(k,{href:\"/react/umd/react.production.min.js\"},\"unpkg.com/react/umd/react.production.min.js\"))),c.jsx(\"p\",null,\"If you omit the file path (i.e. use a \\u201cbare\\u201d URL), unpkg will serve the file specified by the \",\nc.jsx(\"code\",null,\"unpkg\"),\" field in\",\" \",c.jsx(\"code\",null,\"package.json\"),\", or fall back to \",c.jsx(\"code\",null,\"main\"),\".\"),c.jsx(\"ul\",null,c.jsx(\"li\",null,c.jsx(k,{href:\"/jquery\"},\"unpkg.com/jquery\")),c.jsx(\"li\",null,c.jsx(k,{href:\"/three\"},\"unpkg.com/three\"))),c.jsx(\"p\",null,\"Append a \",c.jsx(\"code\",null,\"/\"),\" at the end of a URL to view a listing of all the files in a package.\"),c.jsx(\"ul\",null,c.jsx(\"li\",null,c.jsx(k,{href:\"/react/\"},\"unpkg.com/react/\")),c.jsx(\"li\",null,c.jsx(k,{href:\"/react-router/\"},\n\"unpkg.com/react-router/\"))),c.jsx(\"h3\",{css:{fontSize:\"1.6em\"},id:\"query-params\"},\"Query Parameters\"),c.jsx(\"dl\",null,c.jsx(\"dt\",null,c.jsx(\"code\",null,\"?meta\")),c.jsx(\"dd\",null,\"Return metadata about any file in a package as JSON (e.g.\",c.jsx(\"code\",null,\"/any/file?meta\"),\")\"),c.jsx(\"dt\",null,c.jsx(\"code\",null,\"?module\")),c.jsx(\"dd\",null,\"Expands all\",\" \",c.jsx(k,{href:\"https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier\"},\"\\u201cbare\\u201d \",c.jsx(\"code\",null,\"import\"),\n\" specifiers\"),\" \",\"in JavaScript modules to unpkg URLs. This feature is\",\" \",c.jsx(\"em\",null,\"very experimental\"))),c.jsx(\"h3\",{css:{fontSize:\"1.6em\"},id:\"cache-behavior\"},\"Cache Behavior\"),c.jsx(\"p\",null,\"The CDN caches files based on their permanent URL, which includes the npm package version. This works because npm does not allow package authors to overwrite a package that has already been published with a different one at the same version number.\"),c.jsx(\"p\",null,\"Browsers are instructed (via the \",\nc.jsx(\"code\",null,\"Cache-Control\"),\" header) to cache assets indefinitely (1 year).\"),c.jsx(\"p\",null,\"URLs that do not specify a package version number redirect to one that does. This is the \",c.jsx(\"code\",null,\"latest\"),\" version when no version is specified, or the \",c.jsx(\"code\",null,\"maxSatisfying\"),\" version when a\",\" \",c.jsx(k,{href:\"https://github.com/npm/node-semver\"},\"semver version\"),\" \",\"is given. Redirects are cached for 10 minutes at the CDN, 1 minute in browsers.\"),c.jsx(\"p\",null,\"If you want users to be able to use the latest version when you cut a new release, the best policy is to put the version number in the URL directly in your installation instructions. This will also load more quickly because we won't have to resolve the latest version and redirect them.\"),\nc.jsx(\"h3\",{css:{fontSize:\"1.6em\"},id:\"workflow\"},\"Workflow\"),c.jsx(\"p\",null,\"For npm package authors, unpkg relieves the burden of publishing your code to a CDN in addition to the npm registry. All you need to do is include your\",\" \",c.jsx(k,{href:\"https://github.com/umdjs/umd\"},\"UMD\"),\" build in your npm package (not your repo, that's different!).\"),c.jsx(\"p\",null,\"You can do this easily using the following setup:\"),c.jsx(\"ul\",null,c.jsx(\"li\",null,\"Add the \",c.jsx(\"code\",null,\"umd\"),\" (or \",c.jsx(\"code\",\nnull,\"dist\"),\") directory to your\",\" \",c.jsx(\"code\",null,\".gitignore\"),\" file\"),c.jsx(\"li\",null,\"Add the \",c.jsx(\"code\",null,\"umd\"),\" directory to your\",\" \",c.jsx(k,{href:\"https://docs.npmjs.com/files/package.json#files\"},\"files array\"),\" \",\"in \",c.jsx(\"code\",null,\"package.json\")),c.jsx(\"li\",null,\"Use a build script to generate your UMD build in the\",\" \",c.jsx(\"code\",null,\"umd\"),\" directory when you publish\")),c.jsx(\"p\",null,\"That's it! Now when you \",c.jsx(\"code\",null,\"npm publish\"),\" you'll have a version available on unpkg as well.\"),\nc.jsx(\"h3\",{css:{fontSize:\"1.6em\"},id:\"about\"},\"About\"),c.jsx(\"p\",null,\"unpkg is an\",\" \",c.jsx(k,{href:\"https://github.com/mjackson/unpkg\"},\"open source\"),\" \",\"project built and maintained by\",\" \",c.jsx(k,{href:\"https://twitter.com/mjackson\"},\"Michael Jackson\"),\". unpkg is not affiliated with or supported by npm, Inc. in any way. Please do not contact npm for help with unpkg. Instead, please reach out to \",c.jsx(k,{href:\"https://twitter.com/unpkg\"},\"@unpkg\"),\" with any questions or concerns.\"),c.jsx(\"p\",\nnull,\"The unpkg CDN is powered by\",\" \",c.jsx(k,{href:\"https://www.cloudflare.com\"},\"Cloudflare\"),\", one of the world's largest and fastest cloud network platforms.\",\" \",a&&c.jsx(\"span\",null,\"In the past month, Cloudflare served over\",\" \",c.jsx(\"strong\",null,W(b.totals.bandwidth.all)),\" to\",\" \",c.jsx(\"strong\",null,J(b.totals.uniques.all)),\" unique unpkg users all over the world.\")),c.jsx(\"div\",{css:{margin:\"4em 0\",display:\"flex\",justifyContent:\"center\"}},c.jsx(T,null,c.jsx(\"a\",{href:\"https://www.cloudflare.com\"},\nc.jsx(U,{alt:\"Cloudflare\",src:\"/_client/46bc46bc8accec6a.png\",height:\"100\"})))),c.jsx(\"p\",null,\"The origin servers run on world-class auto-scaling infrastructure provided by\",\" \",c.jsx(k,{href:\"https://cloud.google.com/\"},\"Google Cloud\"),\" which dynamically adjusts the number of available servers to meet the current demand for maximum efficiency and uptime.\"),c.jsx(\"div\",{css:{margin:\"4em 0 0\",display:\"flex\",justifyContent:\"center\"}},c.jsx(T,null,c.jsx(\"a\",{href:\"https://cloud.google.com\"},c.jsx(U,\n{alt:\"Google Cloud\",src:\"/_client/842e885028f6900b.png\",width:\"320\"})))))),c.jsx(\"footer\",{css:{marginTop:\"5rem\",background:\"black\",color:\"#aaa\"}},c.jsx(\"div\",{css:{maxWidth:740,padding:\"10px 20px\",margin:\"0 auto\",display:\"flex\",flexDirection:\"row\",alignItems:\"center\",justifyContent:\"space-between\"}},c.jsx(\"p\",null,c.jsx(\"span\",null,\"Build: \",\"fd447fa\")),c.jsx(\"p\",null,c.jsx(\"span\",null,\"\\u00a9 \",(new Date).getFullYear(),\" UNPKG\")),c.jsx(\"p\",{css:{fontSize:\"1.5rem\"}},c.jsx(\"a\",{href:\"https://twitter.com/unpkg\",\ncss:{color:\"#aaa\",display:\"inline-block\",\":hover\":{color:\"white\"}}},c.jsx(Ga,null)),c.jsx(\"a\",{href:\"https://github.com/mjackson/unpkg\",css:{color:\"#aaa\",display:\"inline-block\",marginLeft:\"1rem\",\":hover\":{color:\"white\"}}},c.jsx(Ha,null))))))}var Ka=\"default\"in n?n[\"default\"]:n;w=w&&Object.prototype.hasOwnProperty.call(w,\"default\")?w[\"default\"]:w;var Pa=E(function(a,b){(function(){function a(a){if(\"object\"===typeof a&&null!==a){var b=a.$$typeof;switch(b){case g:switch(a=a.type,a){case r:case v:case l:case q:case k:case A:return a;\ndefault:switch(a=a&&a.$$typeof,a){case m:case p:case B:case C:case n:return a;default:return b}}case h:return b}}}function c(b){return a(b)===v}var f=\"function\"===typeof Symbol&&Symbol.for,g=f?Symbol.for(\"react.element\"):60103,h=f?Symbol.for(\"react.portal\"):60106,l=f?Symbol.for(\"react.fragment\"):60107,k=f?Symbol.for(\"react.strict_mode\"):60108,q=f?Symbol.for(\"react.profiler\"):60114,n=f?Symbol.for(\"react.provider\"):60109,m=f?Symbol.for(\"react.context\"):60110,r=f?Symbol.for(\"react.async_mode\"):60111,\nv=f?Symbol.for(\"react.concurrent_mode\"):60111,p=f?Symbol.for(\"react.forward_ref\"):60112,A=f?Symbol.for(\"react.suspense\"):60113,La=f?Symbol.for(\"react.suspense_list\"):60120,C=f?Symbol.for(\"react.memo\"):60115,B=f?Symbol.for(\"react.lazy\"):60116,Ma=f?Symbol.for(\"react.block\"):60121,Na=f?Symbol.for(\"react.fundamental\"):60117,t=f?Symbol.for(\"react.responder\"):60118,Oa=f?Symbol.for(\"react.scope\"):60119,u=!1;b.AsyncMode=r;b.ConcurrentMode=v;b.ContextConsumer=m;b.ContextProvider=n;b.Element=g;b.ForwardRef=\np;b.Fragment=l;b.Lazy=B;b.Memo=C;b.Portal=h;b.Profiler=q;b.StrictMode=k;b.Suspense=A;b.isAsyncMode=function(b){u||(u=!0,console.warn(\"The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.\"));return c(b)||a(b)===r};b.isConcurrentMode=c;b.isContextConsumer=function(b){return a(b)===m};b.isContextProvider=function(b){return a(b)===n};b.isElement=function(a){return\"object\"===typeof a&&\nnull!==a&&a.$$typeof===g};b.isForwardRef=function(b){return a(b)===p};b.isFragment=function(b){return a(b)===l};b.isLazy=function(b){return a(b)===B};b.isMemo=function(b){return a(b)===C};b.isPortal=function(b){return a(b)===h};b.isProfiler=function(b){return a(b)===q};b.isStrictMode=function(b){return a(b)===k};b.isSuspense=function(b){return a(b)===A};b.isValidElementType=function(a){return\"string\"===typeof a||\"function\"===typeof a||a===l||a===v||a===q||a===k||a===A||a===La||\"object\"===typeof a&&\nnull!==a&&(a.$$typeof===B||a.$$typeof===C||a.$$typeof===n||a.$$typeof===m||a.$$typeof===p||a.$$typeof===Na||a.$$typeof===t||a.$$typeof===Oa||a.$$typeof===Ma)};b.typeOf=a})()}),Y=E(function(a){a.exports=Pa}),Z=Object.getOwnPropertySymbols,Qa=Object.prototype.hasOwnProperty,Ra=Object.prototype.propertyIsEnumerable,Sa=function(){try{if(!Object.assign)return!1;var a=new String(\"abc\");a[5]=\"de\";if(\"5\"===Object.getOwnPropertyNames(a)[0])return!1;var b={};for(a=0;10>a;a++)b[\"_\"+String.fromCharCode(a)]=a;\nif(\"0123456789\"!==Object.getOwnPropertyNames(b).map(function(a){return b[a]}).join(\"\"))return!1;var c={};\"abcdefghijklmnopqrst\".split(\"\").forEach(function(a){c[a]=a});return\"abcdefghijklmnopqrst\"!==Object.keys(Object.assign({},c)).join(\"\")?!1:!0}catch(d){return!1}}()?Object.assign:function(a,b){if(null===a||void 0===a)throw new TypeError(\"Object.assign cannot be called with null or undefined\");var c=Object(a);for(var d,f=1;f<arguments.length;f++){var g=Object(arguments[f]);for(var h in g)Qa.call(g,\nh)&&(c[h]=g[h]);if(Z){d=Z(g);for(var l=0;l<d.length;l++)Ra.call(g,d[l])&&(c[d[l]]=g[d[l]])}}return c},G=function(){},H={},ja=Function.call.bind(Object.prototype.hasOwnProperty);G=function(a){a=\"Warning: \"+a;\"undefined\"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};F.resetWarningCache=function(){H={}};var Ta=Function.call.bind(Object.prototype.hasOwnProperty),y=function(){};y=function(a){a=\"Warning: \"+a;\"undefined\"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};\nvar Ua=function(a,b){function c(a,b){return a===b?0!==a||1/a===1/b:a!==a&&b!==b}function d(a){this.message=a;this.stack=\"\"}function f(a){function c(c,v,f,p,g,l,h){p=p||\"<<anonymous>>\";l=l||f;if(\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"!==h){if(b)throw c=Error(\"Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types\"),c.name=\"Invariant Violation\",c;\"undefined\"!==typeof console&&\n(h=p+\":\"+f,!e[h]&&3>r&&(y(\"You are manually calling a React.PropTypes validation function for the `\"+l+\"` prop on `\"+p+\"`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.\"),e[h]=!0,r++))}return null==v[f]?c?null===v[f]?new d(\"The \"+g+\" `\"+l+\"` is marked as required \"+(\"in `\"+p+\"`, but its value is `null`.\")):new d(\"The \"+g+\" `\"+l+\"` is marked as required in \"+\n(\"`\"+p+\"`, but its value is `undefined`.\")):null:a(v,f,p,g,l)}var e={},r=0,f=c.bind(null,!1);f.isRequired=c.bind(null,!0);return f}function g(a){return f(function(b,c,e,r,f,g){b=b[c];return l(b)!==a?(b=k(b),new d(\"Invalid \"+r+\" `\"+f+\"` of type \"+(\"`\"+b+\"` supplied to `\"+e+\"`, expected \")+(\"`\"+a+\"`.\"))):null})}function h(b){switch(typeof b){case \"number\":case \"string\":case \"undefined\":return!0;case \"boolean\":return!b;case \"object\":if(Array.isArray(b))return b.every(h);if(null===b||a(b))return!0;var c=\nb&&(n&&b[n]||b[\"@@iterator\"]);var e=\"function\"===typeof c?c:void 0;if(e)if(c=e.call(b),e!==b.entries)for(;!(b=c.next()).done;){if(!h(b.value))return!1}else for(;!(b=c.next()).done;){if((b=b.value)&&!h(b[1]))return!1}else return!1;return!0;default:return!1}}function l(a){var b=typeof a;return Array.isArray(a)?\"array\":a instanceof RegExp?\"object\":\"symbol\"===b||a&&(\"Symbol\"===a[\"@@toStringTag\"]||\"function\"===typeof Symbol&&a instanceof Symbol)?\"symbol\":b}function k(a){if(\"undefined\"===typeof a||null===\na)return\"\"+a;var b=l(a);if(\"object\"===b){if(a instanceof Date)return\"date\";if(a instanceof RegExp)return\"regexp\"}return b}function q(a){a=k(a);switch(a){case \"array\":case \"object\":return\"an \"+a;case \"boolean\":case \"date\":case \"regexp\":return\"a \"+a;default:return a}}var n=\"function\"===typeof Symbol&&Symbol.iterator,m={array:g(\"array\"),bool:g(\"boolean\"),func:g(\"function\"),number:g(\"number\"),object:g(\"object\"),string:g(\"string\"),symbol:g(\"symbol\"),any:f(z),arrayOf:function(a){return f(function(b,c,e,\nf,r){if(\"function\"!==typeof a)return new d(\"Property `\"+r+\"` of component `\"+e+\"` has invalid PropType notation inside arrayOf.\");b=b[c];if(!Array.isArray(b))return b=l(b),new d(\"Invalid \"+f+\" `\"+r+\"` of type \"+(\"`\"+b+\"` supplied to `\"+e+\"`, expected an array.\"));for(c=0;c<b.length;c++){var p=a(b,c,e,f,r+\"[\"+c+\"]\",\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\");if(p instanceof Error)return p}return null})},element:function(){return f(function(b,c,e,f,g){b=b[c];return a(b)?null:(b=l(b),new d(\"Invalid \"+\nf+\" `\"+g+\"` of type \"+(\"`\"+b+\"` supplied to `\"+e+\"`, expected a single ReactElement.\")))})}(),elementType:function(){return f(function(a,b,c,e,f){a=a[b];return Y.isValidElementType(a)?null:(a=l(a),new d(\"Invalid \"+e+\" `\"+f+\"` of type \"+(\"`\"+a+\"` supplied to `\"+c+\"`, expected a single ReactElement type.\")))})}(),instanceOf:function(a){return f(function(b,c,e,f,g){if(!(b[c]instanceof a)){var p=a.name||\"<<anonymous>>\";b=b[c];b=b.constructor&&b.constructor.name?b.constructor.name:\"<<anonymous>>\";return new d(\"Invalid \"+\nf+\" `\"+g+\"` of type \"+(\"`\"+b+\"` supplied to `\"+e+\"`, expected \")+(\"instance of `\"+p+\"`.\"))}return null})},node:function(){return f(function(a,b,c,e,f){return h(a[b])?null:new d(\"Invalid \"+e+\" `\"+f+\"` supplied to \"+(\"`\"+c+\"`, expected a ReactNode.\"))})}(),objectOf:function(a){return f(function(b,c,e,f,g){if(\"function\"!==typeof a)return new d(\"Property `\"+g+\"` of component `\"+e+\"` has invalid PropType notation inside objectOf.\");b=b[c];c=l(b);if(\"object\"!==c)return new d(\"Invalid \"+f+\" `\"+g+\"` of type \"+\n(\"`\"+c+\"` supplied to `\"+e+\"`, expected an object.\"));for(var h in b)if(Ta(b,h)&&(c=a(b,h,e,f,g+\".\"+h,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"),c instanceof Error))return c;return null})},oneOf:function(a){return Array.isArray(a)?f(function(b,e,f,g,h){b=b[e];for(e=0;e<a.length;e++)if(c(b,a[e]))return null;e=JSON.stringify(a,function(a,b){return\"symbol\"===k(b)?String(b):b});return new d(\"Invalid \"+g+\" `\"+h+\"` of value `\"+String(b)+\"` \"+(\"supplied to `\"+f+\"`, expected one of \"+e+\".\"))}):(1<arguments.length?\ny(\"Invalid arguments supplied to oneOf, expected an array, got \"+arguments.length+\" arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).\"):y(\"Invalid argument supplied to oneOf, expected an array.\"),z)},oneOfType:function(a){if(!Array.isArray(a))return y(\"Invalid argument supplied to oneOfType, expected an instance of array.\"),z;for(var b=0;b<a.length;b++){var c=a[b];if(\"function\"!==typeof c)return y(\"Invalid argument supplied to oneOfType. Expected an array of check functions, but received \"+\nq(c)+\" at index \"+b+\".\"),z}return f(function(b,c,e,f,g){for(var h=0;h<a.length;h++)if(null==(0,a[h])(b,c,e,f,g,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return null;return new d(\"Invalid \"+f+\" `\"+g+\"` supplied to \"+(\"`\"+e+\"`.\"))})},shape:function(a){return f(function(b,c,e,f,g){b=b[c];c=l(b);if(\"object\"!==c)return new d(\"Invalid \"+f+\" `\"+g+\"` of type `\"+c+\"` \"+(\"supplied to `\"+e+\"`, expected `object`.\"));for(var h in a)if(c=a[h])if(c=c(b,h,e,f,g+\".\"+h,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return c;\nreturn null})},exact:function(a){return f(function(b,c,e,f,g){var h=b[c],k=l(h);if(\"object\"!==k)return new d(\"Invalid \"+f+\" `\"+g+\"` of type `\"+k+\"` \"+(\"supplied to `\"+e+\"`, expected `object`.\"));k=Sa({},b[c],a);for(var q in k){k=a[q];if(!k)return new d(\"Invalid \"+f+\" `\"+g+\"` key `\"+q+\"` supplied to `\"+e+\"`.\\nBad object: \"+JSON.stringify(b[c],null,\"  \")+\"\\nValid keys: \"+JSON.stringify(Object.keys(a),null,\"  \"));if(k=k(h,q,e,f,g+\".\"+q,\"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED\"))return k}return null})}};\nd.prototype=Error.prototype;m.checkPropTypes=F;m.resetWarningCache=F.resetWarningCache;return m.PropTypes=m},aa=E(function(a){a.exports=Ua(Y.isElement,!0)});let Va=\"B kB MB GB TB PB EB ZB YB\".split(\" \"),Wa=\"B kiB MiB GiB TiB PiB EiB ZiB YiB\".split(\" \"),Xa=\"b kbit Mbit Gbit Tbit Pbit Ebit Zbit Ybit\".split(\" \"),Ya=\"b kibit Mibit Gibit Tibit Pibit Eibit Zibit Yibit\".split(\" \"),ba=(a,b,c)=>{let e=a;if(\"string\"===typeof b||Array.isArray(b))e=a.toLocaleString(b,c);else if(!0===b||void 0!==c)e=a.toLocaleString(void 0,\nc);return e};var W=(a,b)=>{if(!Number.isFinite(a))throw new TypeError(`Expected a finite number, got ${typeof a}: ${a}`);b=Object.assign({bits:!1,binary:!1},b);let c=b.bits?b.binary?Ya:Xa:b.binary?Wa:Va;if(b.signed&&0===a)return` 0 ${c[0]}`;var d=0>a;let f=d?\"-\":b.signed?\"+\":\"\";d&&(a=-a);let g;void 0!==b.minimumFractionDigits&&(g={minimumFractionDigits:b.minimumFractionDigits});void 0!==b.maximumFractionDigits&&(g=Object.assign({maximumFractionDigits:b.maximumFractionDigits},g));if(1>a)return a=ba(a,\nb.locale,g),f+a+\" \"+c[0];d=Math.min(Math.floor(b.binary?Math.log(a)/Math.log(1024):Math.log10(a)/3),c.length-1);a/=Math.pow(b.binary?1024:1E3,d);g||(a=a.toPrecision(3));a=ba(Number(a),b.locale,g);return f+a+\" \"+c[d]},K=function(a){var b=new Date(a.getTime());a=b.getTimezoneOffset();b.setSeconds(0,0);b=b.getTime()%6E4;return 6E4*a+b},Za=/[T ]/,$a=/:/,ab=/^(\\d{2})$/,bb=[/^([+-]\\d{2})$/,/^([+-]\\d{3})$/,/^([+-]\\d{4})$/],cb=/^(\\d{4})/,db=[/^([+-]\\d{4})/,/^([+-]\\d{5})/,/^([+-]\\d{6})/],la=/^-(\\d{2})$/,ma=\n/^-?(\\d{3})$/,na=/^-?(\\d{2})-?(\\d{2})$/,oa=/^-?W(\\d{2})$/,pa=/^-?W(\\d{2})-?(\\d{1})$/,ra=/^(\\d{2}([.,]\\d*)?)$/,sa=/^(\\d{2}):?(\\d{2}([.,]\\d*)?)$/,ta=/^(\\d{2}):?(\\d{2}):?(\\d{2}([.,]\\d*)?)$/,eb=/([Z+-].*)$/,va=/^(Z)$/,wa=/^([+-])(\\d{2})$/,xa=/^([+-])(\\d{2}):?(\\d{2})$/,t=function(a,b){if(a instanceof Date)return new Date(a.getTime());if(\"string\"!==typeof a)return new Date(a);var c=(b||{}).additionalDigits;c=null==c?2:Number(c);var d=a.split(Za);$a.test(d[0])?(b=null,d=d[0]):(b=d[0],d=d[1]);if(d){var f=\neb.exec(d);if(f){var g=d.replace(f[1],\"\");var h=f[1]}else g=d}d=bb[c];c=db[c];(c=cb.exec(b)||c.exec(b))?(d=c[1],c=parseInt(d,10),b=b.slice(d.length)):(c=ab.exec(b)||d.exec(b))?(d=c[1],c=100*parseInt(d,10),b=b.slice(d.length)):(c=null,b=void 0);return(b=ka(b,c))?(a=b.getTime(),b=0,g&&(b=qa(g)),h?g=6E4*ua(h):(c=a+b,h=new Date(c),g=K(h),c=new Date(c),c.setDate(h.getDate()+1),h=K(c)-K(h),0<h&&(g+=h)),new Date(a+b+g)):new Date(a)},ca=function(a){a=t(a);a.setHours(0,0,0,0);return a},da=function(a){var b=\nt(a),c=t(b);a=new Date(0);a.setFullYear(c.getFullYear(),0,1);a.setHours(0,0,0,0);b=ca(b);a=ca(a);b=b.getTime()-6E4*b.getTimezoneOffset();a=a.getTime()-6E4*a.getTimezoneOffset();return Math.round((b-a)/864E5)+1},D=function(a){var b={weekStartsOn:1};b=b?Number(b.weekStartsOn)||0:0;a=t(a);var c=a.getDay();b=(c<b?7:0)+c-b;a.setDate(a.getDate()-b);a.setHours(0,0,0,0);return a},L=function(a){a=t(a);var b=a.getFullYear(),c=new Date(0);c.setFullYear(b+1,0,4);c.setHours(0,0,0,0);c=D(c);var d=new Date(0);d.setFullYear(b,\n0,4);d.setHours(0,0,0,0);d=D(d);return a.getTime()>=c.getTime()?b+1:a.getTime()>=d.getTime()?b:b-1},ea=function(a){var b=t(a);a=D(b).getTime();b=L(b);var c=new Date(0);c.setFullYear(b,0,4);c.setHours(0,0,0,0);b=D(c);a-=b.getTime();return Math.round(a/6048E5)+1},fb=\"M MM Q D DD DDD DDDD d E W WW YY YYYY GG GGGG H HH h hh m mm s ss S SS SSS Z ZZ X x\".split(\" \"),gb=function(a){var b=[],c;for(c in a)a.hasOwnProperty(c)&&b.push(c);a=fb.concat(b).sort().reverse();return new RegExp(\"(\\\\[[^\\\\[]*\\\\])|(\\\\\\\\)?(\"+\na.join(\"|\")+\"|.)\",\"g\")};(function(){var a={lessThanXSeconds:{one:\"less than a second\",other:\"less than {{count}} seconds\"},xSeconds:{one:\"1 second\",other:\"{{count}} seconds\"},halfAMinute:\"half a minute\",lessThanXMinutes:{one:\"less than a minute\",other:\"less than {{count}} minutes\"},xMinutes:{one:\"1 minute\",other:\"{{count}} minutes\"},aboutXHours:{one:\"about 1 hour\",other:\"about {{count}} hours\"},xHours:{one:\"1 hour\",other:\"{{count}} hours\"},xDays:{one:\"1 day\",other:\"{{count}} days\"},aboutXMonths:{one:\"about 1 month\",\nother:\"about {{count}} months\"},xMonths:{one:\"1 month\",other:\"{{count}} months\"},aboutXYears:{one:\"about 1 year\",other:\"about {{count}} years\"},xYears:{one:\"1 year\",other:\"{{count}} years\"},overXYears:{one:\"over 1 year\",other:\"over {{count}} years\"},almostXYears:{one:\"almost 1 year\",other:\"almost {{count}} years\"}};return{localize:function(b,c,d){d=d||{};b=\"string\"===typeof a[b]?a[b]:1===c?a[b].one:a[b].other.replace(\"{{count}}\",c);return d.addSuffix?0<d.comparison?\"in \"+b:b+\" ago\":b}}})();var fa=\nfunction(){var a=\"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec\".split(\" \"),b=\"January February March April May June July August September October November December\".split(\" \"),c=\"Su Mo Tu We Th Fr Sa\".split(\" \"),d=\"Sun Mon Tue Wed Thu Fri Sat\".split(\" \"),f=\"Sunday Monday Tuesday Wednesday Thursday Friday Saturday\".split(\" \"),g=[\"AM\",\"PM\"],h=[\"am\",\"pm\"],l=[\"a.m.\",\"p.m.\"],k={MMM:function(b){return a[b.getMonth()]},MMMM:function(a){return b[a.getMonth()]},dd:function(a){return c[a.getDay()]},ddd:function(a){return d[a.getDay()]},\ndddd:function(a){return f[a.getDay()]},A:function(a){return 1<=a.getHours()/12?g[1]:g[0]},a:function(a){return 1<=a.getHours()/12?h[1]:h[0]},aa:function(a){return 1<=a.getHours()/12?l[1]:l[0]}};\"M D DDD d Q W\".split(\" \").forEach(function(a){k[a+\"o\"]=function(b,c){return ya(c[a](b))}});return{formatters:k,formattingTokensRegExp:gb(k)}}(),I={M:function(a){return a.getMonth()+1},MM:function(a){return m(a.getMonth()+1,2)},Q:function(a){return Math.ceil((a.getMonth()+1)/3)},D:function(a){return a.getDate()},\nDD:function(a){return m(a.getDate(),2)},DDD:function(a){return da(a)},DDDD:function(a){return m(da(a),3)},d:function(a){return a.getDay()},E:function(a){return a.getDay()||7},W:function(a){return ea(a)},WW:function(a){return m(ea(a),2)},YY:function(a){return m(a.getFullYear(),4).substr(2)},YYYY:function(a){return m(a.getFullYear(),4)},GG:function(a){return String(L(a)).substr(2)},GGGG:function(a){return L(a)},H:function(a){return a.getHours()},HH:function(a){return m(a.getHours(),2)},h:function(a){a=\na.getHours();return 0===a?12:12<a?a%12:a},hh:function(a){return m(I.h(a),2)},m:function(a){return a.getMinutes()},mm:function(a){return m(a.getMinutes(),2)},s:function(a){return a.getSeconds()},ss:function(a){return m(a.getSeconds(),2)},S:function(a){return Math.floor(a.getMilliseconds()/100)},SS:function(a){return m(Math.floor(a.getMilliseconds()/10),2)},SSS:function(a){return m(a.getMilliseconds(),3)},Z:function(a){return N(a.getTimezoneOffset(),\":\")},ZZ:function(a){return N(a.getTimezoneOffset())},\nX:function(a){return Math.floor(a.getTime()/1E3)},x:function(a){return a.getTime()}},V=function(a,b,c){b=b?String(b):\"YYYY-MM-DDTHH:mm:ss.SSSZ\";var d=(c||{}).locale;c=fa.formatters;var e=fa.formattingTokensRegExp;d&&d.format&&d.format.formatters&&(c=d.format.formatters,d.format.formattingTokensRegExp&&(e=d.format.formattingTokensRegExp));a=t(a);if(a instanceof Date)d=!isNaN(a);else throw new TypeError(toString.call(a)+\" is not an instance of Date\");return d?za(b,c,e)(a):\"Invalid Date\"},R={color:void 0,\nsize:void 0,className:void 0,style:void 0,attr:void 0},Q=n.createContext&&n.createContext(R),u=window&&window.__assign||function(){u=Object.assign||function(a){for(var b,c=1,d=arguments.length;c<d;c++){b=arguments[c];for(var f in b)Object.prototype.hasOwnProperty.call(b,f)&&(a[f]=b[f])}return a};return u.apply(this,arguments)},Da=window&&window.__rest||function(a,b){var c={},d;for(d in a)Object.prototype.hasOwnProperty.call(a,d)&&0>b.indexOf(d)&&(c[d]=a[d]);if(null!=a&&\"function\"===typeof Object.getOwnPropertySymbols){var f=\n0;for(d=Object.getOwnPropertySymbols(a);f<d.length;f++)0>b.indexOf(d[f])&&(c[d[f]]=a[d[f]])}return c},ha,Ja=c.css(ha||(ha=ia([\"\\n  html {\\n    box-sizing: border-box;\\n  }\\n  *,\\n  *:before,\\n  *:after {\\n    box-sizing: inherit;\\n  }\\n\\n  html,\\n  body,\\n  #root {\\n    height: 100%;\\n    margin: 0;\\n  }\\n\\n  body {\\n    \",\"\\n    font-size: 16px;\\n    line-height: 1.5;\\n    overflow-wrap: break-word;\\n    background: white;\\n    color: black;\\n  }\\n\\n  code {\\n    \",\"\\n    font-size: 1rem;\\n    padding: 0 3px;\\n    background-color: #eee;\\n  }\\n\\n  dd,\\n  ul {\\n    margin-left: 0;\\n    padding-left: 25px;\\n  }\\n\"])),\n'\\nfont-family: -apple-system,\\n  BlinkMacSystemFont,\\n  \"Segoe UI\",\\n  \"Roboto\",\\n  \"Oxygen\",\\n  \"Ubuntu\",\\n  \"Cantarell\",\\n  \"Fira Sans\",\\n  \"Droid Sans\",\\n  \"Helvetica Neue\",\\n  sans-serif;\\n',\"\\nfont-family: Menlo,\\n  Monaco,\\n  Lucida Console,\\n  Liberation Mono,\\n  DejaVu Sans Mono,\\n  Bitstream Vera Sans Mono,\\n  Courier New,\\n  monospace;\\n\");X.propTypes={location:aa.object,children:aa.node};w.render(Ka.createElement(X,null),document.getElementById(\"root\"))})(React,ReactDOM,emotionCore);\n"}]}];

// Virtual module id; see rollup.config.js

function getEntryPoint(name, format) {
  for (let manifest of entryManifest) {
    let bundles = manifest[name];

    if (bundles) {
      return bundles.find(b => b.format === format);
    }
  }

  return null;
}

function getGlobalScripts(entryPoint, globalURLs) {
  return entryPoint.globalImports.map(id => {
    if (process.env.NODE_ENV !== 'production') {
      if (!globalURLs[id]) {
        throw new Error('Missing global URL for id "%s"', id);
      }
    }

    return React.createElement('script', {
      src: globalURLs[id]
    });
  });
}

function getScripts(entryName, format, globalURLs) {
  const entryPoint = getEntryPoint(entryName, format);
  if (!entryPoint) return [];
  return getGlobalScripts(entryPoint, globalURLs).concat( // Inline the code for this entry point into the page
  // itself instead of using another <script> tag
  createScript(entryPoint.code));
}

const doctype = '<!DOCTYPE html>';
const globalURLs = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.production.min.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.production.min.js'
} : {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.development.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.development.js'
};

function byVersion(a, b) {
  return semver.lt(a, b) ? -1 : semver.gt(a, b) ? 1 : 0;
}

async function getAvailableVersions(packageName, log) {
  const versionsAndTags = await getVersionsAndTags(packageName, log);
  return versionsAndTags ? versionsAndTags.versions.sort(byVersion) : [];
}

async function serveBrowsePage(req, res) {
  const availableVersions = await getAvailableVersions(req.packageName, req.log);
  const data = {
    packageName: req.packageName,
    packageVersion: req.packageVersion,
    availableVersions: availableVersions,
    filename: req.filename,
    target: req.browseTarget
  };
  const content = createHTML$1(server$1.renderToString(React.createElement(App, data)));
  const elements = getScripts('browse', 'iife', globalURLs);
  const html = doctype + server$1.renderToStaticMarkup(React.createElement(MainTemplate, {
    title: `UNPKG - ${req.packageName}`,
    description: `The CDN for ${req.packageName}`,
    data,
    content,
    elements
  }));
  res.set({
    'Cache-Control': 'public, max-age=14400',
    // 4 hours
    'Cache-Tag': 'browse'
  }).send(html);
}

var serveBrowsePage$1 = asyncHandler(serveBrowsePage);

async function findMatchingEntries(stream, filename) {
  // filename = /some/dir/name
  return new Promise((accept, reject) => {
    const entries = {};
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Dynamically create "directory" entries for all subdirectories
      // in this entry's path. Some tarballs omit directory entries for
      // some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!entries[dir] && path.dirname(dir) === filename) {
          entries[dir] = {
            path: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      } // Ignore non-files and files that aren't in this directory.


      if (entry.type !== 'file' || path.dirname(entry.path) !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.size = content.length;
        entries[entry.path] = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(entries);
    });
  });
}

async function serveDirectoryBrowser(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const filename = req.filename.slice(0, -1) || '/';
  const entries = await findMatchingEntries(stream, filename);

  if (Object.keys(entries).length === 0) {
    return res.status(404).send(`Not found: ${req.packageSpec}${req.filename}`);
  }

  req.browseTarget = {
    path: filename,
    type: 'directory',
    details: entries
  };
  serveBrowsePage$1(req, res);
}

var serveDirectoryBrowser$1 = asyncHandler(serveDirectoryBrowser);

async function findMatchingEntries$1(stream, filename) {
  // filename = /some/dir/name
  return new Promise((accept, reject) => {
    const entries = {};
    entries[filename] = {
      path: filename,
      type: 'directory'
    };
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Dynamically create "directory" entries for all subdirectories
      // in this entry's path. Some tarballs omit directory entries for
      // some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!entries[dir] && dir.startsWith(filename)) {
          entries[dir] = {
            path: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      } // Ignore non-files and files that don't match the prefix.


      if (entry.type !== 'file' || !entry.path.startsWith(filename)) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length;
        entries[entry.path] = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(entries);
    });
  });
}

function getMatchingEntries(entry, entries) {
  return Object.keys(entries).filter(key => entry.path !== key && path.dirname(key) === entry.path).map(key => entries[key]);
}

function getMetadata(entry, entries) {
  const metadata = {
    path: entry.path,
    type: entry.type
  };

  if (entry.type === 'file') {
    metadata.contentType = entry.contentType;
    metadata.integrity = entry.integrity;
    metadata.lastModified = entry.lastModified;
    metadata.size = entry.size;
  } else if (entry.type === 'directory') {
    metadata.files = getMatchingEntries(entry, entries).map(e => getMetadata(e, entries));
  }

  return metadata;
}

async function serveDirectoryMetadata(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const filename = req.filename.slice(0, -1) || '/';
  const entries = await findMatchingEntries$1(stream, filename);
  const metadata = getMetadata(entries[filename], entries);
  res.send(metadata);
}

var serveDirectoryMetadata$1 = asyncHandler(serveDirectoryMetadata);

function createDataURI(contentType, content) {
  return `data:${contentType};base64,${content.toString('base64')}`;
}

function escapeHTML(code) {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
} // These should probably be added to highlight.js auto-detection.


const extLanguages = {
  map: 'json',
  mjs: 'javascript',
  tsbuildinfo: 'json',
  tsx: 'typescript',
  txt: 'text',
  vue: 'html'
};

function getLanguage(file) {
  // Try to guess the language based on the file extension.
  const ext = path.extname(file).substr(1);

  if (ext) {
    return extLanguages[ext] || ext;
  }

  const contentType = getContentType(file);

  if (contentType === 'text/plain') {
    return 'text';
  }

  return null;
}

function getLines(code) {
  return code.split('\n').map((line, index, array) => index === array.length - 1 ? line : line + '\n');
}
/**
 * Returns an array of HTML strings that highlight the given source code.
 */


function getHighlights(code, file) {
  const language = getLanguage(file);

  if (!language) {
    return null;
  }

  if (language === 'text') {
    return getLines(code).map(escapeHTML);
  }

  try {
    let continuation = false;
    const hi = getLines(code).map(line => {
      const result = hljs.highlight(language, line, false, continuation);
      continuation = result.top;
      return result;
    });
    return hi.map(result => result.value.replace(/<span class="hljs-(\w+)">/g, '<span class="code-$1">'));
  } catch (error) {
    // Probably an "unknown language" error.
    // console.error(error);
    return null;
  }
}

const contentTypeNames = {
  'application/javascript': 'JavaScript',
  'application/json': 'JSON',
  'application/octet-stream': 'Binary',
  'application/vnd.ms-fontobject': 'Embedded OpenType',
  'application/xml': 'XML',
  'image/svg+xml': 'SVG',
  'font/ttf': 'TrueType Font',
  'font/woff': 'WOFF',
  'font/woff2': 'WOFF2',
  'text/css': 'CSS',
  'text/html': 'HTML',
  'text/jsx': 'JSX',
  'text/markdown': 'Markdown',
  'text/plain': 'Plain Text',
  'text/x-scss': 'SCSS',
  'text/yaml': 'YAML'
};
/**
 * Gets a human-friendly name for whatever is in the given file.
 */

function getLanguageName(file) {
  // Content-Type is text/plain, but we can be more descriptive.
  if (/\.flow$/.test(file)) return 'Flow';
  if (/\.(d\.ts|tsx)$/.test(file)) return 'TypeScript'; // Content-Type is application/json, but we can be more descriptive.

  if (/\.map$/.test(file)) return 'Source Map (JSON)';
  const contentType = getContentType(file);
  return contentTypeNames[contentType] || contentType;
}

async function findEntry(stream, filename) {
  // filename = /some/file/name.js
  return new Promise((accept, reject) => {
    let foundEntry = null;
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Ignore non-files and files that don't match the name.

      if (entry.type !== 'file' || entry.path !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        entry.content = await bufferStream(stream);
        foundEntry = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(foundEntry);
    });
  });
}

async function serveFileBrowser(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const entry = await findEntry(stream, req.filename);

  if (!entry) {
    return res.status(404).send(`Not found: ${req.packageSpec}${req.filename}`);
  }

  const details = {
    contentType: getContentType(entry.path),
    integrity: getIntegrity(entry.content),
    language: getLanguageName(entry.path),
    size: entry.content.length
  };

  if (/^image\//.test(details.contentType)) {
    details.uri = createDataURI(details.contentType, entry.content);
    details.highlights = null;
  } else {
    details.uri = null;
    details.highlights = getHighlights(entry.content.toString('utf8'), entry.path);
  }

  req.browseTarget = {
    path: req.filename,
    type: 'file',
    details
  };
  serveBrowsePage$1(req, res);
}

var serveFileBrowser$1 = asyncHandler(serveFileBrowser);

async function findEntry$1(stream, filename) {
  // filename = /some/file/name.js
  return new Promise((accept, reject) => {
    let foundEntry = null;
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Ignore non-files and files that don't match the name.

      if (entry.type !== 'file' || entry.path !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length;
        foundEntry = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(foundEntry);
    });
  });
}

async function serveFileMetadata(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const entry = await findEntry$1(stream, req.filename);

  res.send(entry);
}

var serveFileMetadata$1 = asyncHandler(serveFileMetadata);

function getContentTypeHeader(type) {
  return type === 'application/javascript' ? type + '; charset=utf-8' : type;
}

function serveFile(req, res) {
  const tags = ['file'];
  const ext = path.extname(req.entry.path).substr(1);

  if (ext) {
    tags.push(`${ext}-file`);
  }

  res.set({
    'Content-Type': getContentTypeHeader(req.entry.contentType),
    'Content-Length': req.entry.size,
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Last-Modified': req.entry.lastModified,
    ETag: etag(req.entry.content),
    'Cache-Tag': tags.join(', ')
  }).send(req.entry.content);
}

var MILLISECONDS_IN_MINUTE = 60000;

/**
 * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
 * They usually appear for dates that denote time before the timezones were introduced
 * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
 * and GMT+01:00:00 after that date)
 *
 * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
 * which would lead to incorrect calculations.
 *
 * This function returns the timezone offset in milliseconds that takes seconds in account.
 */
var getTimezoneOffsetInMilliseconds = function getTimezoneOffsetInMilliseconds (dirtyDate) {
  var date = new Date(dirtyDate.getTime());
  var baseTimezoneOffset = date.getTimezoneOffset();
  date.setSeconds(0, 0);
  var millisecondsPartOfTimezoneOffset = date.getTime() % MILLISECONDS_IN_MINUTE;

  return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset
};

/**
 * @category Common Helpers
 * @summary Is the given argument an instance of Date?
 *
 * @description
 * Is the given argument an instance of Date?
 *
 * @param {*} argument - the argument to check
 * @returns {Boolean} the given argument is an instance of Date
 *
 * @example
 * // Is 'mayonnaise' a Date?
 * var result = isDate('mayonnaise')
 * //=> false
 */
function isDate (argument) {
  return argument instanceof Date
}

var is_date = isDate;

var MILLISECONDS_IN_HOUR = 3600000;
var MILLISECONDS_IN_MINUTE$1 = 60000;
var DEFAULT_ADDITIONAL_DIGITS = 2;

var parseTokenDateTimeDelimeter = /[T ]/;
var parseTokenPlainTime = /:/;

// year tokens
var parseTokenYY = /^(\d{2})$/;
var parseTokensYYY = [
  /^([+-]\d{2})$/, // 0 additional digits
  /^([+-]\d{3})$/, // 1 additional digit
  /^([+-]\d{4})$/ // 2 additional digits
];

var parseTokenYYYY = /^(\d{4})/;
var parseTokensYYYYY = [
  /^([+-]\d{4})/, // 0 additional digits
  /^([+-]\d{5})/, // 1 additional digit
  /^([+-]\d{6})/ // 2 additional digits
];

// date tokens
var parseTokenMM = /^-(\d{2})$/;
var parseTokenDDD = /^-?(\d{3})$/;
var parseTokenMMDD = /^-?(\d{2})-?(\d{2})$/;
var parseTokenWww = /^-?W(\d{2})$/;
var parseTokenWwwD = /^-?W(\d{2})-?(\d{1})$/;

// time tokens
var parseTokenHH = /^(\d{2}([.,]\d*)?)$/;
var parseTokenHHMM = /^(\d{2}):?(\d{2}([.,]\d*)?)$/;
var parseTokenHHMMSS = /^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/;

// timezone tokens
var parseTokenTimezone = /([Z+-].*)$/;
var parseTokenTimezoneZ = /^(Z)$/;
var parseTokenTimezoneHH = /^([+-])(\d{2})$/;
var parseTokenTimezoneHHMM = /^([+-])(\d{2}):?(\d{2})$/;

/**
 * @category Common Helpers
 * @summary Convert the given argument to an instance of Date.
 *
 * @description
 * Convert the given argument to an instance of Date.
 *
 * If the argument is an instance of Date, the function returns its clone.
 *
 * If the argument is a number, it is treated as a timestamp.
 *
 * If an argument is a string, the function tries to parse it.
 * Function accepts complete ISO 8601 formats as well as partial implementations.
 * ISO 8601: http://en.wikipedia.org/wiki/ISO_8601
 *
 * If all above fails, the function passes the given argument to Date constructor.
 *
 * @param {Date|String|Number} argument - the value to convert
 * @param {Object} [options] - the object with options
 * @param {0 | 1 | 2} [options.additionalDigits=2] - the additional number of digits in the extended year format
 * @returns {Date} the parsed date in the local time zone
 *
 * @example
 * // Convert string '2014-02-11T11:30:30' to date:
 * var result = parse('2014-02-11T11:30:30')
 * //=> Tue Feb 11 2014 11:30:30
 *
 * @example
 * // Parse string '+02014101',
 * // if the additional number of digits in the extended year format is 1:
 * var result = parse('+02014101', {additionalDigits: 1})
 * //=> Fri Apr 11 2014 00:00:00
 */
function parse (argument, dirtyOptions) {
  if (is_date(argument)) {
    // Prevent the date to lose the milliseconds when passed to new Date() in IE10
    return new Date(argument.getTime())
  } else if (typeof argument !== 'string') {
    return new Date(argument)
  }

  var options = dirtyOptions || {};
  var additionalDigits = options.additionalDigits;
  if (additionalDigits == null) {
    additionalDigits = DEFAULT_ADDITIONAL_DIGITS;
  } else {
    additionalDigits = Number(additionalDigits);
  }

  var dateStrings = splitDateString(argument);

  var parseYearResult = parseYear(dateStrings.date, additionalDigits);
  var year = parseYearResult.year;
  var restDateString = parseYearResult.restDateString;

  var date = parseDate(restDateString, year);

  if (date) {
    var timestamp = date.getTime();
    var time = 0;
    var offset;

    if (dateStrings.time) {
      time = parseTime(dateStrings.time);
    }

    if (dateStrings.timezone) {
      offset = parseTimezone(dateStrings.timezone) * MILLISECONDS_IN_MINUTE$1;
    } else {
      var fullTime = timestamp + time;
      var fullTimeDate = new Date(fullTime);

      offset = getTimezoneOffsetInMilliseconds(fullTimeDate);

      // Adjust time when it's coming from DST
      var fullTimeDateNextDay = new Date(fullTime);
      fullTimeDateNextDay.setDate(fullTimeDate.getDate() + 1);
      var offsetDiff =
        getTimezoneOffsetInMilliseconds(fullTimeDateNextDay) -
        getTimezoneOffsetInMilliseconds(fullTimeDate);
      if (offsetDiff > 0) {
        offset += offsetDiff;
      }
    }

    return new Date(timestamp + time + offset)
  } else {
    return new Date(argument)
  }
}

function splitDateString (dateString) {
  var dateStrings = {};
  var array = dateString.split(parseTokenDateTimeDelimeter);
  var timeString;

  if (parseTokenPlainTime.test(array[0])) {
    dateStrings.date = null;
    timeString = array[0];
  } else {
    dateStrings.date = array[0];
    timeString = array[1];
  }

  if (timeString) {
    var token = parseTokenTimezone.exec(timeString);
    if (token) {
      dateStrings.time = timeString.replace(token[1], '');
      dateStrings.timezone = token[1];
    } else {
      dateStrings.time = timeString;
    }
  }

  return dateStrings
}

function parseYear (dateString, additionalDigits) {
  var parseTokenYYY = parseTokensYYY[additionalDigits];
  var parseTokenYYYYY = parseTokensYYYYY[additionalDigits];

  var token;

  // YYYY or ±YYYYY
  token = parseTokenYYYY.exec(dateString) || parseTokenYYYYY.exec(dateString);
  if (token) {
    var yearString = token[1];
    return {
      year: parseInt(yearString, 10),
      restDateString: dateString.slice(yearString.length)
    }
  }

  // YY or ±YYY
  token = parseTokenYY.exec(dateString) || parseTokenYYY.exec(dateString);
  if (token) {
    var centuryString = token[1];
    return {
      year: parseInt(centuryString, 10) * 100,
      restDateString: dateString.slice(centuryString.length)
    }
  }

  // Invalid ISO-formatted year
  return {
    year: null
  }
}

function parseDate (dateString, year) {
  // Invalid ISO-formatted year
  if (year === null) {
    return null
  }

  var token;
  var date;
  var month;
  var week;

  // YYYY
  if (dateString.length === 0) {
    date = new Date(0);
    date.setUTCFullYear(year);
    return date
  }

  // YYYY-MM
  token = parseTokenMM.exec(dateString);
  if (token) {
    date = new Date(0);
    month = parseInt(token[1], 10) - 1;
    date.setUTCFullYear(year, month);
    return date
  }

  // YYYY-DDD or YYYYDDD
  token = parseTokenDDD.exec(dateString);
  if (token) {
    date = new Date(0);
    var dayOfYear = parseInt(token[1], 10);
    date.setUTCFullYear(year, 0, dayOfYear);
    return date
  }

  // YYYY-MM-DD or YYYYMMDD
  token = parseTokenMMDD.exec(dateString);
  if (token) {
    date = new Date(0);
    month = parseInt(token[1], 10) - 1;
    var day = parseInt(token[2], 10);
    date.setUTCFullYear(year, month, day);
    return date
  }

  // YYYY-Www or YYYYWww
  token = parseTokenWww.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    return dayOfISOYear(year, week)
  }

  // YYYY-Www-D or YYYYWwwD
  token = parseTokenWwwD.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    var dayOfWeek = parseInt(token[2], 10) - 1;
    return dayOfISOYear(year, week, dayOfWeek)
  }

  // Invalid ISO-formatted date
  return null
}

function parseTime (timeString) {
  var token;
  var hours;
  var minutes;

  // hh
  token = parseTokenHH.exec(timeString);
  if (token) {
    hours = parseFloat(token[1].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR
  }

  // hh:mm or hhmm
  token = parseTokenHHMM.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseFloat(token[2].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR +
      minutes * MILLISECONDS_IN_MINUTE$1
  }

  // hh:mm:ss or hhmmss
  token = parseTokenHHMMSS.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseInt(token[2], 10);
    var seconds = parseFloat(token[3].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR +
      minutes * MILLISECONDS_IN_MINUTE$1 +
      seconds * 1000
  }

  // Invalid ISO-formatted time
  return null
}

function parseTimezone (timezoneString) {
  var token;
  var absoluteOffset;

  // Z
  token = parseTokenTimezoneZ.exec(timezoneString);
  if (token) {
    return 0
  }

  // ±hh
  token = parseTokenTimezoneHH.exec(timezoneString);
  if (token) {
    absoluteOffset = parseInt(token[2], 10) * 60;
    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
  }

  // ±hh:mm or ±hhmm
  token = parseTokenTimezoneHHMM.exec(timezoneString);
  if (token) {
    absoluteOffset = parseInt(token[2], 10) * 60 + parseInt(token[3], 10);
    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
  }

  return 0
}

function dayOfISOYear (isoYear, week, day) {
  week = week || 0;
  day = day || 0;
  var date = new Date(0);
  date.setUTCFullYear(isoYear, 0, 4);
  var fourthOfJanuaryDay = date.getUTCDay() || 7;
  var diff = week * 7 + day + 1 - fourthOfJanuaryDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return date
}

var parse_1 = parse;

/**
 * @category Year Helpers
 * @summary Return the start of a year for the given date.
 *
 * @description
 * Return the start of a year for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of a year
 *
 * @example
 * // The start of a year for 2 September 2014 11:55:00:
 * var result = startOfYear(new Date(2014, 8, 2, 11, 55, 00))
 * //=> Wed Jan 01 2014 00:00:00
 */
function startOfYear (dirtyDate) {
  var cleanDate = parse_1(dirtyDate);
  var date = new Date(0);
  date.setFullYear(cleanDate.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_year = startOfYear;

/**
 * @category Day Helpers
 * @summary Return the start of a day for the given date.
 *
 * @description
 * Return the start of a day for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of a day
 *
 * @example
 * // The start of a day for 2 September 2014 11:55:00:
 * var result = startOfDay(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Tue Sep 02 2014 00:00:00
 */
function startOfDay (dirtyDate) {
  var date = parse_1(dirtyDate);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_day = startOfDay;

var MILLISECONDS_IN_MINUTE$2 = 60000;
var MILLISECONDS_IN_DAY = 86400000;

/**
 * @category Day Helpers
 * @summary Get the number of calendar days between the given dates.
 *
 * @description
 * Get the number of calendar days between the given dates.
 *
 * @param {Date|String|Number} dateLeft - the later date
 * @param {Date|String|Number} dateRight - the earlier date
 * @returns {Number} the number of calendar days
 *
 * @example
 * // How many calendar days are between
 * // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?
 * var result = differenceInCalendarDays(
 *   new Date(2012, 6, 2, 0, 0),
 *   new Date(2011, 6, 2, 23, 0)
 * )
 * //=> 366
 */
function differenceInCalendarDays (dirtyDateLeft, dirtyDateRight) {
  var startOfDayLeft = start_of_day(dirtyDateLeft);
  var startOfDayRight = start_of_day(dirtyDateRight);

  var timestampLeft = startOfDayLeft.getTime() -
    startOfDayLeft.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;
  var timestampRight = startOfDayRight.getTime() -
    startOfDayRight.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;

  // Round the number of days to the nearest integer
  // because the number of milliseconds in a day is not constant
  // (e.g. it's different in the day of the daylight saving time clock shift)
  return Math.round((timestampLeft - timestampRight) / MILLISECONDS_IN_DAY)
}

var difference_in_calendar_days = differenceInCalendarDays;

/**
 * @category Day Helpers
 * @summary Get the day of the year of the given date.
 *
 * @description
 * Get the day of the year of the given date.
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the day of year
 *
 * @example
 * // Which day of the year is 2 July 2014?
 * var result = getDayOfYear(new Date(2014, 6, 2))
 * //=> 183
 */
function getDayOfYear (dirtyDate) {
  var date = parse_1(dirtyDate);
  var diff = difference_in_calendar_days(date, start_of_year(date));
  var dayOfYear = diff + 1;
  return dayOfYear
}

var get_day_of_year = getDayOfYear;

/**
 * @category Week Helpers
 * @summary Return the start of a week for the given date.
 *
 * @description
 * Return the start of a week for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @param {Object} [options] - the object with options
 * @param {Number} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
 * @returns {Date} the start of a week
 *
 * @example
 * // The start of a week for 2 September 2014 11:55:00:
 * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Sun Aug 31 2014 00:00:00
 *
 * @example
 * // If the week starts on Monday, the start of the week for 2 September 2014 11:55:00:
 * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0), {weekStartsOn: 1})
 * //=> Mon Sep 01 2014 00:00:00
 */
function startOfWeek (dirtyDate, dirtyOptions) {
  var weekStartsOn = dirtyOptions ? (Number(dirtyOptions.weekStartsOn) || 0) : 0;

  var date = parse_1(dirtyDate);
  var day = date.getDay();
  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;

  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_week = startOfWeek;

/**
 * @category ISO Week Helpers
 * @summary Return the start of an ISO week for the given date.
 *
 * @description
 * Return the start of an ISO week for the given date.
 * The result will be in the local timezone.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of an ISO week
 *
 * @example
 * // The start of an ISO week for 2 September 2014 11:55:00:
 * var result = startOfISOWeek(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Mon Sep 01 2014 00:00:00
 */
function startOfISOWeek (dirtyDate) {
  return start_of_week(dirtyDate, {weekStartsOn: 1})
}

var start_of_iso_week = startOfISOWeek;

/**
 * @category ISO Week-Numbering Year Helpers
 * @summary Get the ISO week-numbering year of the given date.
 *
 * @description
 * Get the ISO week-numbering year of the given date,
 * which always starts 3 days before the year's first Thursday.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the ISO week-numbering year
 *
 * @example
 * // Which ISO-week numbering year is 2 January 2005?
 * var result = getISOYear(new Date(2005, 0, 2))
 * //=> 2004
 */
function getISOYear (dirtyDate) {
  var date = parse_1(dirtyDate);
  var year = date.getFullYear();

  var fourthOfJanuaryOfNextYear = new Date(0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  var startOfNextYear = start_of_iso_week(fourthOfJanuaryOfNextYear);

  var fourthOfJanuaryOfThisYear = new Date(0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  var startOfThisYear = start_of_iso_week(fourthOfJanuaryOfThisYear);

  if (date.getTime() >= startOfNextYear.getTime()) {
    return year + 1
  } else if (date.getTime() >= startOfThisYear.getTime()) {
    return year
  } else {
    return year - 1
  }
}

var get_iso_year = getISOYear;

/**
 * @category ISO Week-Numbering Year Helpers
 * @summary Return the start of an ISO week-numbering year for the given date.
 *
 * @description
 * Return the start of an ISO week-numbering year,
 * which always starts 3 days before the year's first Thursday.
 * The result will be in the local timezone.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of an ISO year
 *
 * @example
 * // The start of an ISO week-numbering year for 2 July 2005:
 * var result = startOfISOYear(new Date(2005, 6, 2))
 * //=> Mon Jan 03 2005 00:00:00
 */
function startOfISOYear (dirtyDate) {
  var year = get_iso_year(dirtyDate);
  var fourthOfJanuary = new Date(0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  var date = start_of_iso_week(fourthOfJanuary);
  return date
}

var start_of_iso_year = startOfISOYear;

var MILLISECONDS_IN_WEEK = 604800000;

/**
 * @category ISO Week Helpers
 * @summary Get the ISO week of the given date.
 *
 * @description
 * Get the ISO week of the given date.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the ISO week
 *
 * @example
 * // Which week of the ISO-week numbering year is 2 January 2005?
 * var result = getISOWeek(new Date(2005, 0, 2))
 * //=> 53
 */
function getISOWeek (dirtyDate) {
  var date = parse_1(dirtyDate);
  var diff = start_of_iso_week(date).getTime() - start_of_iso_year(date).getTime();

  // Round the number of days to the nearest integer
  // because the number of milliseconds in a week is not constant
  // (e.g. it's different in the week of the daylight saving time clock shift)
  return Math.round(diff / MILLISECONDS_IN_WEEK) + 1
}

var get_iso_week = getISOWeek;

/**
 * @category Common Helpers
 * @summary Is the given date valid?
 *
 * @description
 * Returns false if argument is Invalid Date and true otherwise.
 * Invalid Date is a Date, whose time value is NaN.
 *
 * Time value of Date: http://es5.github.io/#x15.9.1.1
 *
 * @param {Date} date - the date to check
 * @returns {Boolean} the date is valid
 * @throws {TypeError} argument must be an instance of Date
 *
 * @example
 * // For the valid date:
 * var result = isValid(new Date(2014, 1, 31))
 * //=> true
 *
 * @example
 * // For the invalid date:
 * var result = isValid(new Date(''))
 * //=> false
 */
function isValid (dirtyDate) {
  if (is_date(dirtyDate)) {
    return !isNaN(dirtyDate)
  } else {
    throw new TypeError(toString.call(dirtyDate) + ' is not an instance of Date')
  }
}

var is_valid = isValid;

function buildDistanceInWordsLocale () {
  var distanceInWordsLocale = {
    lessThanXSeconds: {
      one: 'less than a second',
      other: 'less than {{count}} seconds'
    },

    xSeconds: {
      one: '1 second',
      other: '{{count}} seconds'
    },

    halfAMinute: 'half a minute',

    lessThanXMinutes: {
      one: 'less than a minute',
      other: 'less than {{count}} minutes'
    },

    xMinutes: {
      one: '1 minute',
      other: '{{count}} minutes'
    },

    aboutXHours: {
      one: 'about 1 hour',
      other: 'about {{count}} hours'
    },

    xHours: {
      one: '1 hour',
      other: '{{count}} hours'
    },

    xDays: {
      one: '1 day',
      other: '{{count}} days'
    },

    aboutXMonths: {
      one: 'about 1 month',
      other: 'about {{count}} months'
    },

    xMonths: {
      one: '1 month',
      other: '{{count}} months'
    },

    aboutXYears: {
      one: 'about 1 year',
      other: 'about {{count}} years'
    },

    xYears: {
      one: '1 year',
      other: '{{count}} years'
    },

    overXYears: {
      one: 'over 1 year',
      other: 'over {{count}} years'
    },

    almostXYears: {
      one: 'almost 1 year',
      other: 'almost {{count}} years'
    }
  };

  function localize (token, count, options) {
    options = options || {};

    var result;
    if (typeof distanceInWordsLocale[token] === 'string') {
      result = distanceInWordsLocale[token];
    } else if (count === 1) {
      result = distanceInWordsLocale[token].one;
    } else {
      result = distanceInWordsLocale[token].other.replace('{{count}}', count);
    }

    if (options.addSuffix) {
      if (options.comparison > 0) {
        return 'in ' + result
      } else {
        return result + ' ago'
      }
    }

    return result
  }

  return {
    localize: localize
  }
}

var build_distance_in_words_locale = buildDistanceInWordsLocale;

var commonFormatterKeys = [
  'M', 'MM', 'Q', 'D', 'DD', 'DDD', 'DDDD', 'd',
  'E', 'W', 'WW', 'YY', 'YYYY', 'GG', 'GGGG',
  'H', 'HH', 'h', 'hh', 'm', 'mm',
  's', 'ss', 'S', 'SS', 'SSS',
  'Z', 'ZZ', 'X', 'x'
];

function buildFormattingTokensRegExp (formatters) {
  var formatterKeys = [];
  for (var key in formatters) {
    if (formatters.hasOwnProperty(key)) {
      formatterKeys.push(key);
    }
  }

  var formattingTokens = commonFormatterKeys
    .concat(formatterKeys)
    .sort()
    .reverse();
  var formattingTokensRegExp = new RegExp(
    '(\\[[^\\[]*\\])|(\\\\)?' + '(' + formattingTokens.join('|') + '|.)', 'g'
  );

  return formattingTokensRegExp
}

var build_formatting_tokens_reg_exp = buildFormattingTokensRegExp;

function buildFormatLocale () {
  // Note: in English, the names of days of the week and months are capitalized.
  // If you are making a new locale based on this one, check if the same is true for the language you're working on.
  // Generally, formatted dates should look like they are in the middle of a sentence,
  // e.g. in Spanish language the weekdays and months should be in the lowercase.
  var months3char = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var weekdays2char = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var weekdays3char = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var weekdaysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var meridiemUppercase = ['AM', 'PM'];
  var meridiemLowercase = ['am', 'pm'];
  var meridiemFull = ['a.m.', 'p.m.'];

  var formatters = {
    // Month: Jan, Feb, ..., Dec
    'MMM': function (date) {
      return months3char[date.getMonth()]
    },

    // Month: January, February, ..., December
    'MMMM': function (date) {
      return monthsFull[date.getMonth()]
    },

    // Day of week: Su, Mo, ..., Sa
    'dd': function (date) {
      return weekdays2char[date.getDay()]
    },

    // Day of week: Sun, Mon, ..., Sat
    'ddd': function (date) {
      return weekdays3char[date.getDay()]
    },

    // Day of week: Sunday, Monday, ..., Saturday
    'dddd': function (date) {
      return weekdaysFull[date.getDay()]
    },

    // AM, PM
    'A': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemUppercase[1] : meridiemUppercase[0]
    },

    // am, pm
    'a': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemLowercase[1] : meridiemLowercase[0]
    },

    // a.m., p.m.
    'aa': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemFull[1] : meridiemFull[0]
    }
  };

  // Generate ordinal version of formatters: M -> Mo, D -> Do, etc.
  var ordinalFormatters = ['M', 'D', 'DDD', 'd', 'Q', 'W'];
  ordinalFormatters.forEach(function (formatterToken) {
    formatters[formatterToken + 'o'] = function (date, formatters) {
      return ordinal(formatters[formatterToken](date))
    };
  });

  return {
    formatters: formatters,
    formattingTokensRegExp: build_formatting_tokens_reg_exp(formatters)
  }
}

function ordinal (number) {
  var rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + 'st'
      case 2:
        return number + 'nd'
      case 3:
        return number + 'rd'
    }
  }
  return number + 'th'
}

var build_format_locale = buildFormatLocale;

/**
 * @category Locales
 * @summary English locale.
 */
var en = {
  distanceInWords: build_distance_in_words_locale(),
  format: build_format_locale()
};

/**
 * @category Common Helpers
 * @summary Format the date.
 *
 * @description
 * Return the formatted date string in the given format.
 *
 * Accepted tokens:
 * | Unit                    | Token | Result examples                  |
 * |-------------------------|-------|----------------------------------|
 * | Month                   | M     | 1, 2, ..., 12                    |
 * |                         | Mo    | 1st, 2nd, ..., 12th              |
 * |                         | MM    | 01, 02, ..., 12                  |
 * |                         | MMM   | Jan, Feb, ..., Dec               |
 * |                         | MMMM  | January, February, ..., December |
 * | Quarter                 | Q     | 1, 2, 3, 4                       |
 * |                         | Qo    | 1st, 2nd, 3rd, 4th               |
 * | Day of month            | D     | 1, 2, ..., 31                    |
 * |                         | Do    | 1st, 2nd, ..., 31st              |
 * |                         | DD    | 01, 02, ..., 31                  |
 * | Day of year             | DDD   | 1, 2, ..., 366                   |
 * |                         | DDDo  | 1st, 2nd, ..., 366th             |
 * |                         | DDDD  | 001, 002, ..., 366               |
 * | Day of week             | d     | 0, 1, ..., 6                     |
 * |                         | do    | 0th, 1st, ..., 6th               |
 * |                         | dd    | Su, Mo, ..., Sa                  |
 * |                         | ddd   | Sun, Mon, ..., Sat               |
 * |                         | dddd  | Sunday, Monday, ..., Saturday    |
 * | Day of ISO week         | E     | 1, 2, ..., 7                     |
 * | ISO week                | W     | 1, 2, ..., 53                    |
 * |                         | Wo    | 1st, 2nd, ..., 53rd              |
 * |                         | WW    | 01, 02, ..., 53                  |
 * | Year                    | YY    | 00, 01, ..., 99                  |
 * |                         | YYYY  | 1900, 1901, ..., 2099            |
 * | ISO week-numbering year | GG    | 00, 01, ..., 99                  |
 * |                         | GGGG  | 1900, 1901, ..., 2099            |
 * | AM/PM                   | A     | AM, PM                           |
 * |                         | a     | am, pm                           |
 * |                         | aa    | a.m., p.m.                       |
 * | Hour                    | H     | 0, 1, ... 23                     |
 * |                         | HH    | 00, 01, ... 23                   |
 * |                         | h     | 1, 2, ..., 12                    |
 * |                         | hh    | 01, 02, ..., 12                  |
 * | Minute                  | m     | 0, 1, ..., 59                    |
 * |                         | mm    | 00, 01, ..., 59                  |
 * | Second                  | s     | 0, 1, ..., 59                    |
 * |                         | ss    | 00, 01, ..., 59                  |
 * | 1/10 of second          | S     | 0, 1, ..., 9                     |
 * | 1/100 of second         | SS    | 00, 01, ..., 99                  |
 * | Millisecond             | SSS   | 000, 001, ..., 999               |
 * | Timezone                | Z     | -01:00, +00:00, ... +12:00       |
 * |                         | ZZ    | -0100, +0000, ..., +1200         |
 * | Seconds timestamp       | X     | 512969520                        |
 * | Milliseconds timestamp  | x     | 512969520900                     |
 *
 * The characters wrapped in square brackets are escaped.
 *
 * The result may vary by locale.
 *
 * @param {Date|String|Number} date - the original date
 * @param {String} [format='YYYY-MM-DDTHH:mm:ss.SSSZ'] - the string of tokens
 * @param {Object} [options] - the object with options
 * @param {Object} [options.locale=enLocale] - the locale object
 * @returns {String} the formatted date string
 *
 * @example
 * // Represent 11 February 2014 in middle-endian format:
 * var result = format(
 *   new Date(2014, 1, 11),
 *   'MM/DD/YYYY'
 * )
 * //=> '02/11/2014'
 *
 * @example
 * // Represent 2 July 2014 in Esperanto:
 * var eoLocale = require('date-fns/locale/eo')
 * var result = format(
 *   new Date(2014, 6, 2),
 *   'Do [de] MMMM YYYY',
 *   {locale: eoLocale}
 * )
 * //=> '2-a de julio 2014'
 */
function format (dirtyDate, dirtyFormatStr, dirtyOptions) {
  var formatStr = dirtyFormatStr ? String(dirtyFormatStr) : 'YYYY-MM-DDTHH:mm:ss.SSSZ';
  var options = dirtyOptions || {};

  var locale = options.locale;
  var localeFormatters = en.format.formatters;
  var formattingTokensRegExp = en.format.formattingTokensRegExp;
  if (locale && locale.format && locale.format.formatters) {
    localeFormatters = locale.format.formatters;

    if (locale.format.formattingTokensRegExp) {
      formattingTokensRegExp = locale.format.formattingTokensRegExp;
    }
  }

  var date = parse_1(dirtyDate);

  if (!is_valid(date)) {
    return 'Invalid Date'
  }

  var formatFn = buildFormatFn(formatStr, localeFormatters, formattingTokensRegExp);

  return formatFn(date)
}

var formatters = {
  // Month: 1, 2, ..., 12
  'M': function (date) {
    return date.getMonth() + 1
  },

  // Month: 01, 02, ..., 12
  'MM': function (date) {
    return addLeadingZeros(date.getMonth() + 1, 2)
  },

  // Quarter: 1, 2, 3, 4
  'Q': function (date) {
    return Math.ceil((date.getMonth() + 1) / 3)
  },

  // Day of month: 1, 2, ..., 31
  'D': function (date) {
    return date.getDate()
  },

  // Day of month: 01, 02, ..., 31
  'DD': function (date) {
    return addLeadingZeros(date.getDate(), 2)
  },

  // Day of year: 1, 2, ..., 366
  'DDD': function (date) {
    return get_day_of_year(date)
  },

  // Day of year: 001, 002, ..., 366
  'DDDD': function (date) {
    return addLeadingZeros(get_day_of_year(date), 3)
  },

  // Day of week: 0, 1, ..., 6
  'd': function (date) {
    return date.getDay()
  },

  // Day of ISO week: 1, 2, ..., 7
  'E': function (date) {
    return date.getDay() || 7
  },

  // ISO week: 1, 2, ..., 53
  'W': function (date) {
    return get_iso_week(date)
  },

  // ISO week: 01, 02, ..., 53
  'WW': function (date) {
    return addLeadingZeros(get_iso_week(date), 2)
  },

  // Year: 00, 01, ..., 99
  'YY': function (date) {
    return addLeadingZeros(date.getFullYear(), 4).substr(2)
  },

  // Year: 1900, 1901, ..., 2099
  'YYYY': function (date) {
    return addLeadingZeros(date.getFullYear(), 4)
  },

  // ISO week-numbering year: 00, 01, ..., 99
  'GG': function (date) {
    return String(get_iso_year(date)).substr(2)
  },

  // ISO week-numbering year: 1900, 1901, ..., 2099
  'GGGG': function (date) {
    return get_iso_year(date)
  },

  // Hour: 0, 1, ... 23
  'H': function (date) {
    return date.getHours()
  },

  // Hour: 00, 01, ..., 23
  'HH': function (date) {
    return addLeadingZeros(date.getHours(), 2)
  },

  // Hour: 1, 2, ..., 12
  'h': function (date) {
    var hours = date.getHours();
    if (hours === 0) {
      return 12
    } else if (hours > 12) {
      return hours % 12
    } else {
      return hours
    }
  },

  // Hour: 01, 02, ..., 12
  'hh': function (date) {
    return addLeadingZeros(formatters['h'](date), 2)
  },

  // Minute: 0, 1, ..., 59
  'm': function (date) {
    return date.getMinutes()
  },

  // Minute: 00, 01, ..., 59
  'mm': function (date) {
    return addLeadingZeros(date.getMinutes(), 2)
  },

  // Second: 0, 1, ..., 59
  's': function (date) {
    return date.getSeconds()
  },

  // Second: 00, 01, ..., 59
  'ss': function (date) {
    return addLeadingZeros(date.getSeconds(), 2)
  },

  // 1/10 of second: 0, 1, ..., 9
  'S': function (date) {
    return Math.floor(date.getMilliseconds() / 100)
  },

  // 1/100 of second: 00, 01, ..., 99
  'SS': function (date) {
    return addLeadingZeros(Math.floor(date.getMilliseconds() / 10), 2)
  },

  // Millisecond: 000, 001, ..., 999
  'SSS': function (date) {
    return addLeadingZeros(date.getMilliseconds(), 3)
  },

  // Timezone: -01:00, +00:00, ... +12:00
  'Z': function (date) {
    return formatTimezone(date.getTimezoneOffset(), ':')
  },

  // Timezone: -0100, +0000, ... +1200
  'ZZ': function (date) {
    return formatTimezone(date.getTimezoneOffset())
  },

  // Seconds timestamp: 512969520
  'X': function (date) {
    return Math.floor(date.getTime() / 1000)
  },

  // Milliseconds timestamp: 512969520900
  'x': function (date) {
    return date.getTime()
  }
};

function buildFormatFn (formatStr, localeFormatters, formattingTokensRegExp) {
  var array = formatStr.match(formattingTokensRegExp);
  var length = array.length;

  var i;
  var formatter;
  for (i = 0; i < length; i++) {
    formatter = localeFormatters[array[i]] || formatters[array[i]];
    if (formatter) {
      array[i] = formatter;
    } else {
      array[i] = removeFormattingTokens(array[i]);
    }
  }

  return function (date) {
    var output = '';
    for (var i = 0; i < length; i++) {
      if (array[i] instanceof Function) {
        output += array[i](date, formatters);
      } else {
        output += array[i];
      }
    }
    return output
  }
}

function removeFormattingTokens (input) {
  if (input.match(/\[[\s\S]/)) {
    return input.replace(/^\[|]$/g, '')
  }
  return input.replace(/\\/g, '')
}

function formatTimezone (offset, delimeter) {
  delimeter = delimeter || '';
  var sign = offset > 0 ? '-' : '+';
  var absOffset = Math.abs(offset);
  var hours = Math.floor(absOffset / 60);
  var minutes = absOffset % 60;
  return sign + addLeadingZeros(hours, 2) + delimeter + addLeadingZeros(minutes, 2)
}

function addLeadingZeros (number, targetLength) {
  var output = Math.abs(number).toString();
  while (output.length < targetLength) {
    output = '0' + output;
  }
  return output
}

var format_1 = format;

function createIcon$1(Type, _ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return core.jsx(Type, _extends({
    css: _extends({}, css, {
      verticalAlign: 'text-bottom'
    })
  }, rest));
}

function TwitterIcon$1(props) {
  return createIcon$1(FaTwitter, props);
}
function GitHubIcon$1(props) {
  return createIcon$1(FaGithub, props);
}

var CloudflareLogo = "/_client/46bc46bc8accec6a.png";

var GoogleCloudLogo = "/_client/842e885028f6900b.png";

var _templateObject$1;
var buildId$1 = "fd447fa";
var globalStyles$1 = core.css(_templateObject$1 || (_templateObject$1 = _taggedTemplateLiteralLoose(["\n  html {\n    box-sizing: border-box;\n  }\n  *,\n  *:before,\n  *:after {\n    box-sizing: inherit;\n  }\n\n  html,\n  body,\n  #root {\n    height: 100%;\n    margin: 0;\n  }\n\n  body {\n    ", "\n    font-size: 16px;\n    line-height: 1.5;\n    overflow-wrap: break-word;\n    background: white;\n    color: black;\n  }\n\n  code {\n    ", "\n    font-size: 1rem;\n    padding: 0 3px;\n    background-color: #eee;\n  }\n\n  dd,\n  ul {\n    margin-left: 0;\n    padding-left: 25px;\n  }\n"])), fontSans, fontMono);

function Link$1(props) {
  return (// eslint-disable-next-line jsx-a11y/anchor-has-content
    core.jsx("a", _extends({}, props, {
      css: {
        color: '#0076ff',
        textDecoration: 'none',
        ':hover': {
          textDecoration: 'underline'
        }
      }
    }))
  );
}

function AboutLogo(_ref) {
  var children = _ref.children;
  return core.jsx("div", {
    css: {
      textAlign: 'center',
      flex: '1'
    }
  }, children);
}

function AboutLogoImage(props) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return core.jsx("img", _extends({}, props, {
    css: {
      maxWidth: '90%'
    }
  }));
}

function Stats(_ref2) {
  var data = _ref2.data;
  var totals = data.totals;
  var since = parse_1(totals.since);
  var until = parse_1(totals.until);
  return core.jsx("p", null, "From ", core.jsx("strong", null, format_1(since, 'MMM D')), " to", ' ', core.jsx("strong", null, format_1(until, 'MMM D')), " unpkg served", ' ', core.jsx("strong", null, formatNumber(totals.requests.all)), " requests and a total of ", core.jsx("strong", null, formatBytes(totals.bandwidth.all)), " of data to", ' ', core.jsx("strong", null, formatNumber(totals.uniques.all)), " unique visitors,", ' ', core.jsx("strong", null, formatPercent(totals.requests.cached / totals.requests.all, 2), "%"), ' ', "of which were served from the cache.");
}

function App$1() {
  var _useState = React.useState(typeof window === 'object' && window.localStorage && window.localStorage.savedStats ? JSON.parse(window.localStorage.savedStats) : null),
      stats = _useState[0],
      setStats = _useState[1];

  var hasStats = !!(stats && !stats.error);
  var stringStats = JSON.stringify(stats);
  React.useEffect(function () {
    window.localStorage.savedStats = stringStats;
  }, [stringStats]);
  React.useEffect(function () {
    fetch('/api/stats?period=last-month').then(function (res) {
      return res.json();
    }).then(setStats);
  }, []);
  return core.jsx(React.Fragment, null, core.jsx(core.Global, {
    styles: globalStyles$1
  }), core.jsx("div", {
    css: {
      maxWidth: 740,
      margin: '0 auto'
    }
  }, core.jsx("div", {
    css: {
      padding: '0 20px'
    }
  }, core.jsx("header", null, core.jsx("h1", {
    css: {
      textAlign: 'center',
      fontSize: '4.5em',
      letterSpacing: '0.05em',
      '@media (min-width: 700px)': {
        marginTop: '1.5em'
      }
    }
  }, "UNPKG"), core.jsx("p", null, "unpkg is a fast, global content delivery network for everything on", ' ', core.jsx(Link$1, {
    href: "https://www.npmjs.com/"
  }, "npm"), ". Use it to quickly and easily load any file from any package using a URL like:"), core.jsx("div", {
    css: {
      textAlign: 'center',
      backgroundColor: '#eee',
      margin: '2em 0',
      padding: '5px 0'
    }
  }, "unpkg.com/:package@:version/:file"), hasStats && core.jsx(Stats, {
    data: stats
  })), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "examples"
  }, "Examples"), core.jsx("p", null, "Using a fixed version:"), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react@16.7.0/umd/react.production.min.js"
  }, "unpkg.com/react@16.7.0/umd/react.production.min.js")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react-dom@16.7.0/umd/react-dom.production.min.js"
  }, "unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js"))), core.jsx("p", null, "You may also use a", ' ', core.jsx(Link$1, {
    href: "https://docs.npmjs.com/misc/semver"
  }, "semver range"), ' ', "or a ", core.jsx(Link$1, {
    href: "https://docs.npmjs.com/cli/dist-tag"
  }, "tag"), ' ', "instead of a fixed version number, or omit the version/tag entirely to use the ", core.jsx("code", null, "latest"), " tag."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react@^16/umd/react.production.min.js"
  }, "unpkg.com/react@^16/umd/react.production.min.js")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react/umd/react.production.min.js"
  }, "unpkg.com/react/umd/react.production.min.js"))), core.jsx("p", null, "If you omit the file path (i.e. use a \u201Cbare\u201D URL), unpkg will serve the file specified by the ", core.jsx("code", null, "unpkg"), " field in", ' ', core.jsx("code", null, "package.json"), ", or fall back to ", core.jsx("code", null, "main"), "."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/jquery"
  }, "unpkg.com/jquery")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/three"
  }, "unpkg.com/three"))), core.jsx("p", null, "Append a ", core.jsx("code", null, "/"), " at the end of a URL to view a listing of all the files in a package."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react/"
  }, "unpkg.com/react/")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react-router/"
  }, "unpkg.com/react-router/"))), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "query-params"
  }, "Query Parameters"), core.jsx("dl", null, core.jsx("dt", null, core.jsx("code", null, "?meta")), core.jsx("dd", null, "Return metadata about any file in a package as JSON (e.g.", core.jsx("code", null, "/any/file?meta"), ")"), core.jsx("dt", null, core.jsx("code", null, "?module")), core.jsx("dd", null, "Expands all", ' ', core.jsx(Link$1, {
    href: "https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier"
  }, "\u201Cbare\u201D ", core.jsx("code", null, "import"), " specifiers"), ' ', "in JavaScript modules to unpkg URLs. This feature is", ' ', core.jsx("em", null, "very experimental"))), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "cache-behavior"
  }, "Cache Behavior"), core.jsx("p", null, "The CDN caches files based on their permanent URL, which includes the npm package version. This works because npm does not allow package authors to overwrite a package that has already been published with a different one at the same version number."), core.jsx("p", null, "Browsers are instructed (via the ", core.jsx("code", null, "Cache-Control"), " header) to cache assets indefinitely (1 year)."), core.jsx("p", null, "URLs that do not specify a package version number redirect to one that does. This is the ", core.jsx("code", null, "latest"), " version when no version is specified, or the ", core.jsx("code", null, "maxSatisfying"), " version when a", ' ', core.jsx(Link$1, {
    href: "https://github.com/npm/node-semver"
  }, "semver version"), ' ', "is given. Redirects are cached for 10 minutes at the CDN, 1 minute in browsers."), core.jsx("p", null, "If you want users to be able to use the latest version when you cut a new release, the best policy is to put the version number in the URL directly in your installation instructions. This will also load more quickly because we won't have to resolve the latest version and redirect them."), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "workflow"
  }, "Workflow"), core.jsx("p", null, "For npm package authors, unpkg relieves the burden of publishing your code to a CDN in addition to the npm registry. All you need to do is include your", ' ', core.jsx(Link$1, {
    href: "https://github.com/umdjs/umd"
  }, "UMD"), " build in your npm package (not your repo, that's different!)."), core.jsx("p", null, "You can do this easily using the following setup:"), core.jsx("ul", null, core.jsx("li", null, "Add the ", core.jsx("code", null, "umd"), " (or ", core.jsx("code", null, "dist"), ") directory to your", ' ', core.jsx("code", null, ".gitignore"), " file"), core.jsx("li", null, "Add the ", core.jsx("code", null, "umd"), " directory to your", ' ', core.jsx(Link$1, {
    href: "https://docs.npmjs.com/files/package.json#files"
  }, "files array"), ' ', "in ", core.jsx("code", null, "package.json")), core.jsx("li", null, "Use a build script to generate your UMD build in the", ' ', core.jsx("code", null, "umd"), " directory when you publish")), core.jsx("p", null, "That's it! Now when you ", core.jsx("code", null, "npm publish"), " you'll have a version available on unpkg as well."), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "about"
  }, "About"), core.jsx("p", null, "unpkg is an", ' ', core.jsx(Link$1, {
    href: "https://github.com/mjackson/unpkg"
  }, "open source"), ' ', "project built and maintained by", ' ', core.jsx(Link$1, {
    href: "https://twitter.com/mjackson"
  }, "Michael Jackson"), ". unpkg is not affiliated with or supported by npm, Inc. in any way. Please do not contact npm for help with unpkg. Instead, please reach out to ", core.jsx(Link$1, {
    href: "https://twitter.com/unpkg"
  }, "@unpkg"), " with any questions or concerns."), core.jsx("p", null, "The unpkg CDN is powered by", ' ', core.jsx(Link$1, {
    href: "https://www.cloudflare.com"
  }, "Cloudflare"), ", one of the world's largest and fastest cloud network platforms.", ' ', hasStats && core.jsx("span", null, "In the past month, Cloudflare served over", ' ', core.jsx("strong", null, formatBytes(stats.totals.bandwidth.all)), " to", ' ', core.jsx("strong", null, formatNumber(stats.totals.uniques.all)), " unique unpkg users all over the world.")), core.jsx("div", {
    css: {
      margin: '4em 0',
      display: 'flex',
      justifyContent: 'center'
    }
  }, core.jsx(AboutLogo, null, core.jsx("a", {
    href: "https://www.cloudflare.com"
  }, core.jsx(AboutLogoImage, {
    alt: "Cloudflare",
    src: CloudflareLogo,
    height: "100"
  })))), core.jsx("p", null, "The origin servers run on world-class auto-scaling infrastructure provided by", ' ', core.jsx(Link$1, {
    href: "https://cloud.google.com/"
  }, "Google Cloud"), " which dynamically adjusts the number of available servers to meet the current demand for maximum efficiency and uptime."), core.jsx("div", {
    css: {
      margin: '4em 0 0',
      display: 'flex',
      justifyContent: 'center'
    }
  }, core.jsx(AboutLogo, null, core.jsx("a", {
    href: "https://cloud.google.com"
  }, core.jsx(AboutLogoImage, {
    alt: "Google Cloud",
    src: GoogleCloudLogo,
    width: "320"
  })))))), core.jsx("footer", {
    css: {
      marginTop: '5rem',
      background: 'black',
      color: '#aaa'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: 740,
      padding: '10px 20px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, core.jsx("p", null, core.jsx("span", null, "Build: ", buildId$1)), core.jsx("p", null, core.jsx("span", null, "\xA9 ", new Date().getFullYear(), " UNPKG")), core.jsx("p", {
    css: {
      fontSize: '1.5rem'
    }
  }, core.jsx("a", {
    href: "https://twitter.com/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(TwitterIcon$1, null)), core.jsx("a", {
    href: "https://github.com/mjackson/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      marginLeft: '1rem',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(GitHubIcon$1, null))))));
}

if (process.env.NODE_ENV !== 'production') {
  App$1.propTypes = {
    location: PropTypes.object,
    children: PropTypes.node
  };
}

const doctype$1 = '<!DOCTYPE html>';
const globalURLs$1 = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.production.min.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.production.min.js'
} : {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.development.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.development.js'
};
function serveMainPage(req, res) {
  const content = createHTML$1(server$1.renderToString(React.createElement(App$1)));
  const elements = getScripts('main', 'iife', globalURLs$1);
  const html = doctype$1 + server$1.renderToStaticMarkup(React.createElement(MainTemplate, {
    content,
    elements
  }));
  res.set({
    'Cache-Control': 'public, max-age=14400',
    // 4 hours
    'Cache-Tag': 'main'
  }).send(html);
}

const bareIdentifierFormat = /^((?:@[^/]+\/)?[^/]+)(\/.*)?$/;

function isValidURL(value) {
  return URL.parseURL(value) != null;
}

function isProbablyURLWithoutProtocol(value) {
  return value.substr(0, 2) === '//';
}

function isAbsoluteURL(value) {
  return isValidURL(value) || isProbablyURLWithoutProtocol(value);
}

function isBareIdentifier(value) {
  return value.charAt(0) !== '.' && value.charAt(0) !== '/';
}

function rewriteValue(
/* StringLiteral */
node, origin, dependencies) {
  if (isAbsoluteURL(node.value)) {
    return;
  }

  if (isBareIdentifier(node.value)) {
    // "bare" identifier
    const match = bareIdentifierFormat.exec(node.value);
    const packageName = match[1];
    const file = match[2] || '';
    warning(dependencies[packageName], 'Missing version info for package "%s" in dependencies; falling back to "latest"', packageName);
    const version = dependencies[packageName] || 'latest';
    node.value = `${origin}/${packageName}@${version}${file}?module`;
  } else {
    // local path
    node.value = `${node.value}?module`;
  }
}

function unpkgRewrite(origin, dependencies = {}) {
  return {
    manipulateOptions(opts, parserOpts) {
      parserOpts.plugins.push('dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'importMeta');
    },

    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') {
          // Some other function call, not import();
          return;
        }

        rewriteValue(path.node.arguments[0], origin, dependencies);
      },

      ExportAllDeclaration(path) {
        rewriteValue(path.node.source, origin, dependencies);
      },

      ExportNamedDeclaration(path) {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return;
        }

        rewriteValue(path.node.source, origin, dependencies);
      },

      ImportDeclaration(path) {
        rewriteValue(path.node.source, origin, dependencies);
      }

    }
  };
}

const origin =  'https://unpkg.com';
function rewriteBareModuleIdentifiers(code, packageConfig) {
  const dependencies = Object.assign({}, packageConfig.peerDependencies, packageConfig.dependencies);
  const options = {
    // Ignore .babelrc and package.json babel config
    // because we haven't installed dependencies so
    // we can't load plugins; see #84
    babelrc: false,
    // Make a reasonable attempt to preserve whitespace
    // from the original file. This ensures minified
    // .mjs stays minified; see #149
    retainLines: true,
    plugins: [unpkgRewrite(origin, dependencies)]
  };
  return babel.transform(code, options).code;
}

function serveHTMLModule(req, res) {
  try {
    const $ = cheerio.load(req.entry.content.toString('utf8'));
    $('script[type=module]').each((index, element) => {
      $(element).html(rewriteBareModuleIdentifiers($(element).html(), req.packageConfig));
    });
    const code = $.html();
    res.set({
      'Content-Length': Buffer.byteLength(code),
      'Content-Type': getContentTypeHeader(req.entry.contentType),
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      ETag: etag(code),
      'Cache-Tag': 'file, html-file, html-module'
    }).send(code);
  } catch (error) {
    console.error(error);
    const errorName = error.constructor.name;
    const errorMessage = error.message.replace(/^.*?\/unpkg-.+?\//, `/${req.packageSpec}/`);
    const codeFrame = error.codeFrame;
    const debugInfo = `${errorName}: ${errorMessage}\n\n${codeFrame}`;
    res.status(500).type('text').send(`Cannot generate module for ${req.packageSpec}${req.filename}\n\n${debugInfo}`);
  }
}

function serveJavaScriptModule(req, res) {
  try {
    const code = rewriteBareModuleIdentifiers(req.entry.content.toString('utf8'), req.packageConfig);
    res.set({
      'Content-Length': Buffer.byteLength(code),
      'Content-Type': getContentTypeHeader(req.entry.contentType),
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      ETag: etag(code),
      'Cache-Tag': 'file, js-file, js-module'
    }).send(code);
  } catch (error) {
    console.error(error);
    const errorName = error.constructor.name;
    const errorMessage = error.message.replace(/^.*?\/unpkg-.+?\//, `/${req.packageSpec}/`);
    const codeFrame = error.codeFrame;
    const debugInfo = `${errorName}: ${errorMessage}\n\n${codeFrame}`;
    res.status(500).type('text').send(`Cannot generate module for ${req.packageSpec}${req.filename}\n\n${debugInfo}`);
  }
}

function serveModule(req, res) {
  if (req.entry.contentType === 'application/javascript') {
    return serveJavaScriptModule(req, res);
  }

  if (req.entry.contentType === 'text/html') {
    return serveHTMLModule(req, res);
  }

  res.status(403).type('text').send('module mode is available only for JavaScript and HTML files');
}

const cloudflareURL = 'https://github.com/zababurinsv';
const cloudflareEmail = 's.zababurin.v@gmail.com';
const cloudflareKey = '203gfkfhtm43';

if (process.env.NODE_ENV !== 'production') ;

function get$1(path, headers) {
  return fetch$1(`${cloudflareURL}${path}`, {
    headers: Object.assign({}, headers, {
      'X-Auth-Email': cloudflareEmail,
      'X-Auth-Key': cloudflareKey
    })
  });
}

function getJSON(path, headers) {
  return get$1(path, headers).then(res => {
    return res.json();
  }).then(data => {
    if (!data.success) {
      console.error(`cloudflare.getJSON failed at ${path}`);
      console.error(data);
      throw new Error('Failed to getJSON from Cloudflare');
    }

    return data.result;
  });
}

function getZones(domains) {
  return Promise.all((Array.isArray(domains) ? domains : [domains]).map(domain => getJSON(`/zones?name=${domain}`))).then(results => results.reduce((memo, zones) => memo.concat(zones)));
}

function reduceResults(target, values) {
  Object.keys(values).forEach(key => {
    const value = values[key];

    if (typeof value === 'object' && value) {
      target[key] = reduceResults(target[key] || {}, value);
    } else if (typeof value === 'number') {
      target[key] = (target[key] || 0) + values[key];
    }
  });
  return target;
}

function getZoneAnalyticsDashboard(zones, since, until) {
  return Promise.all((Array.isArray(zones) ? zones : [zones]).map(zone => {
    return getJSON(`/zones/${zone.id}/analytics/dashboard?since=${since.toISOString()}&until=${until.toISOString()}`);
  })).then(results => results.reduce(reduceResults));
}

function extractPublicInfo(data) {
  return {
    since: data.since,
    until: data.until,
    requests: {
      all: data.requests.all,
      cached: data.requests.cached,
      country: data.requests.country,
      status: data.requests.http_status
    },
    bandwidth: {
      all: data.bandwidth.all,
      cached: data.bandwidth.cached,
      country: data.bandwidth.country
    },
    threats: {
      all: data.threats.all,
      country: data.threats.country
    },
    uniques: {
      all: data.uniques.all
    }
  };
}

const DomainNames = ['unpkg.com', 'npmcdn.com'];
async function getStats(since, until) {
  const zones = await getZones(DomainNames);
  const dashboard = await getZoneAnalyticsDashboard(zones, since, until);
  return {
    timeseries: dashboard.timeseries.map(extractPublicInfo),
    totals: extractPublicInfo(dashboard.totals)
  };
}

function serveStats(req, res) {
  let since, until;

  if (req.query.period) {
    switch (req.query.period) {
      case 'last-day':
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 1);
        break;

      case 'last-week':
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 7);
        break;

      case 'last-month':
      default:
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 30);
    }
  } else {
    until = req.query.until ? new Date(req.query.until) : dateFns.startOfDay(new Date());
    since = req.query.since ? new Date(req.query.since) : dateFns.subDays(until, 1);
  }

  if (isNaN(since.getTime())) {
    return res.status(403).send({
      error: '?since is not a valid date'
    });
  }

  if (isNaN(until.getTime())) {
    return res.status(403).send({
      error: '?until is not a valid date'
    });
  }

  if (until <= since) {
    return res.status(403).send({
      error: '?until date must come after ?since date'
    });
  }

  if (until >= new Date()) {
    return res.status(403).send({
      error: '?until must be a date in the past'
    });
  }

  getStats(since, until).then(stats => {
    res.set({
      'Cache-Control': 'public, max-age=3600',
      // 1 hour
      'Cache-Tag': 'stats'
    }).send(stats);
  }, error => {
    console.error(error);
    res.status(500).send({
      error: 'Unable to fetch stats'
    });
  });
}

function createSearch(query) {
  const keys = Object.keys(query).sort();
  const pairs = keys.reduce((memo, key) => memo.concat(query[key] == null || query[key] === '' ? key : `${key}=${encodeURIComponent(query[key])}`), []);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

/**
 * Reject URLs with invalid query parameters to increase cache hit rates.
 */

function allowQuery(validKeys = []) {
  if (!Array.isArray(validKeys)) {
    validKeys = [validKeys];
  }

  return (req, res, next) => {
    const keys = Object.keys(req.query);

    if (!keys.every(key => validKeys.includes(key))) {
      const newQuery = keys.filter(key => validKeys.includes(key)).reduce((query, key) => {
        query[key] = req.query[key];
        return query;
      }, {});
      return res.redirect(302, req.baseUrl + req.path + createSearch(newQuery));
    }

    next();
  };
}

function createPackageURL(packageName, packageVersion, filename, query) {
  let url = `/${packageName}`;
  if (packageVersion) url += `@${packageVersion}`;
  if (filename) url += filename;
  if (query) url += createSearch(query);
  return url;
}

function fileRedirect(req, res, entry) {
  // Redirect to the file with the extension so it's
  // clear which file is being served.
  res.set({
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Cache-Tag': 'redirect, file-redirect'
  }).redirect(302, createPackageURL(req.packageName, req.packageVersion, entry.path, req.query));
}

function indexRedirect(req, res, entry) {
  // Redirect to the index file so relative imports
  // resolve correctly.
  res.set({
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Cache-Tag': 'redirect, index-redirect'
  }).redirect(302, createPackageURL(req.packageName, req.packageVersion, entry.path, req.query));
}
/**
 * Search the given tarball for entries that match the given name.
 * Follows node's resolution algorithm.
 * https://nodejs.org/api/modules.html#modules_all_together
 */


function searchEntries(stream, filename) {
  // filename = /some/file/name.js or /some/dir/name
  return new Promise((accept, reject) => {
    const jsEntryFilename = `${filename}.js`;
    const jsonEntryFilename = `${filename}.json`;
    const matchingEntries = {};
    let foundEntry;

    if (filename === '/') {
      foundEntry = matchingEntries['/'] = {
        name: '/',
        type: 'directory'
      };
    }

    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+/g, ''),
        type: header.type
      }; // Skip non-files and files that don't match the entryName.

      if (entry.type !== 'file' || !entry.path.startsWith(filename)) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      matchingEntries[entry.path] = entry; // Dynamically create "directory" entries for all directories
      // that are in this file's path. Some tarballs omit these entries
      // for some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!matchingEntries[dir]) {
          matchingEntries[dir] = {
            name: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      }

      if (entry.path === filename || // Allow accessing e.g. `/index.js` or `/index.json`
      // using `/index` for compatibility with npm
      entry.path === jsEntryFilename || entry.path === jsonEntryFilename) {
        if (foundEntry) {
          if (foundEntry.path !== filename && (entry.path === filename || entry.path === jsEntryFilename && foundEntry.path === jsonEntryFilename)) {
            // This entry is higher priority than the one
            // we already found. Replace it.
            delete foundEntry.content;
            foundEntry = entry;
          }
        } else {
          foundEntry = entry;
        }
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length; // Set the content only for the foundEntry and
        // discard the buffer for all others.

        if (entry === foundEntry) {
          entry.content = content;
        }

        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept({
        // If we didn't find a matching file entry,
        // try a directory entry with the same name.
        foundEntry: foundEntry || matchingEntries[filename] || null,
        matchingEntries: matchingEntries
      });
    });
  });
}
/**
 * Fetch and search the archive to try and find the requested file.
 * Redirect to the "index" file if a directory was requested.
 */


async function findEntry$2(req, res, next) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const {
    foundEntry: entry,
    matchingEntries: entries
  } = await searchEntries(stream, req.filename);

  if (!entry) {
    return res.status(404).set({
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      'Cache-Tag': 'missing, missing-entry'
    }).type('text').send(`Cannot find "${req.filename}" in ${req.packageSpec}`);
  }

  if (entry.type === 'file' && entry.path !== req.filename) {
    return fileRedirect(req, res, entry);
  }

  if (entry.type === 'directory') {
    // We need to redirect to some "index" file inside the directory so
    // our URLs work in a similar way to require("lib") in node where it
    // uses `lib/index.js` when `lib` is a directory.
    const indexEntry = entries[`${req.filename}/index.js`] || entries[`${req.filename}/index.json`];

    if (indexEntry && indexEntry.type === 'file') {
      return indexRedirect(req, res, indexEntry);
    }

    return res.status(404).set({
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      'Cache-Tag': 'missing, missing-index'
    }).type('text').send(`Cannot find an index in "${req.filename}" in ${req.packageSpec}`);
  }

  req.entry = entry;
  next();
}

var findEntry$3 = asyncHandler(findEntry$2);

/**
 * Strips all query params from the URL to increase cache hit rates.
 */
function noQuery() {
  return (req, res, next) => {
    const keys = Object.keys(req.query);

    if (keys.length) {
      return res.redirect(302, req.baseUrl + req.path);
    }

    next();
  };
}

/**
 * Redirect old URLs that we no longer support.
 */

function redirectLegacyURLs(req, res, next) {
  // Permanently redirect /_meta/path to /path?meta
  if (req.path.match(/^\/_meta\//)) {
    req.query.meta = '';
    return res.redirect(301, req.path.substr(6) + createSearch(req.query));
  } // Permanently redirect /path?json => /path?meta


  if (req.query.json != null) {
    delete req.query.json;
    req.query.meta = '';
    return res.redirect(301, req.path + createSearch(req.query));
  }

  next();
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const enableDebugging = process.env.DEBUG != null;

function noop() {}

function createLog(req) {
  const traceContext = req.headers['x-cloud-trace-context'];

  if (projectId && traceContext) {
    const [traceId, spanId] = traceContext.split('/');
    const trace = `projects/${projectId}/traces/${traceId}`;
    return {
      debug: enableDebugging ? (format, ...args) => {
        console.log(JSON.stringify({
          severity: 'DEBUG',
          'logging.googleapis.com/trace': trace,
          'logging.googleapis.com/spanId': spanId,
          message: util.format(format, ...args)
        }));
      } : noop,
      info: (format, ...args) => {
        console.log(JSON.stringify({
          severity: 'INFO',
          'logging.googleapis.com/trace': trace,
          'logging.googleapis.com/spanId': spanId,
          message: util.format(format, ...args)
        }));
      },
      error: (format, ...args) => {
        console.error(JSON.stringify({
          severity: 'ERROR',
          'logging.googleapis.com/trace': trace,
          'logging.googleapis.com/spanId': spanId,
          message: util.format(format, ...args)
        }));
      }
    };
  }

  return {
    debug: enableDebugging ? (format, ...args) => {
      console.log(util.format(format, ...args));
    } : noop,
    info: (format, ...args) => {
      console.log(util.format(format, ...args));
    },
    error: (format, ...args) => {
      console.error(util.format(format, ...args));
    }
  };
}

function requestLog(req, res, next) {
  req.log = createLog(req);
  next();
}

function filenameRedirect(req, res) {
  let filename;

  if (req.query.module != null) {
    // See https://github.com/rollup/rollup/wiki/pkg.module
    filename = req.packageConfig.module || req.packageConfig['jsnext:main'];

    if (!filename) {
      // https://nodejs.org/api/esm.html#esm_code_package_json_code_code_type_code_field
      if (req.packageConfig.type === 'module') {
        // Use whatever is in pkg.main or index.js
        filename = req.packageConfig.main || '/index.js';
      } else if (req.packageConfig.main && /\.mjs$/.test(req.packageConfig.main)) {
        // Use .mjs file in pkg.main
        filename = req.packageConfig.main;
      }
    }

    if (!filename) {
      return res.status(404).type('text').send(`Package ${req.packageSpec} does not contain an ES module`);
    }
  } else if (req.query.main && req.packageConfig[req.query.main] && typeof req.packageConfig[req.query.main] === 'string') {
    // Deprecated, see #63
    filename = req.packageConfig[req.query.main];
  } else if (req.packageConfig.unpkg && typeof req.packageConfig.unpkg === 'string') {
    filename = req.packageConfig.unpkg;
  } else if (req.packageConfig.browser && typeof req.packageConfig.browser === 'string') {
    // Deprecated, see #63
    filename = req.packageConfig.browser;
  } else {
    filename = req.packageConfig.main || '/index.js';
  } // Redirect to the exact filename so relative imports
  // and URLs resolve correctly.


  res.set({
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Cache-Tag': 'redirect, filename-redirect'
  }).redirect(302, createPackageURL(req.packageName, req.packageVersion, filename.replace(/^[./]*/, '/'), req.query));
}
/**
 * Redirect to the exact filename if the request omits one.
 */


async function validateFilename(req, res, next) {
  if (!req.filename) {
    return filenameRedirect(req, res);
  }

  next();
}

const packagePathnameFormat = /^\/((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(\/.*)?$/;
function parsePackagePathname(pathname) {
  try {
    pathname = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }

  const match = packagePathnameFormat.exec(pathname); // Disallow invalid pathnames.

  if (match == null) return null;
  const packageName = match[1];
  const packageVersion = match[2] || 'latest';
  const filename = (match[3] || '').replace(/\/\/+/g, '/');
  return {
    // If the pathname is /@scope/name@version/file.js:
    packageName,
    // @scope/name
    packageVersion,
    // version
    packageSpec: `${packageName}@${packageVersion}`,
    // @scope/name@version
    filename // /file.js

  };
}

/**
 * Parse the pathname in the URL. Reject invalid URLs.
 */

function validatePackagePathname(req, res, next) {
  const parsed = parsePackagePathname(req.path);

  if (parsed == null) {
    return res.status(403).send({
      error: `Invalid URL: ${req.path}`
    });
  }

  req.packageName = parsed.packageName;
  req.packageVersion = parsed.packageVersion;
  req.packageSpec = parsed.packageSpec;
  req.filename = parsed.filename;
  next();
}

const hexValue = /^[a-f0-9]+$/i;

function isHash(value) {
  return value.length === 32 && hexValue.test(value);
}
/**
 * Reject requests for invalid npm package names.
 */


function validatePackageName(req, res, next) {
  if (isHash(req.packageName)) {
    return res.status(403).type('text').send(`Invalid package name "${req.packageName}" (cannot be a hash)`);
  }

  const errors = validateNpmPackageName(req.packageName).errors;

  if (errors) {
    const reason = errors.join(', ');
    return res.status(403).type('text').send(`Invalid package name "${req.packageName}" (${reason})`);
  }

  next();
}

function semverRedirect(req, res, newVersion) {
  res.set({
    'Cache-Control': 'public, s-maxage=600, max-age=60',
    // 10 mins on CDN, 1 min on clients
    'Cache-Tag': 'redirect, semver-redirect'
  }).redirect(302, req.baseUrl + createPackageURL(req.packageName, newVersion, req.filename, req.query));
}

async function resolveVersion(packageName, range, log) {
  const versionsAndTags = await getVersionsAndTags(packageName, log);

  if (versionsAndTags) {
    const {
      versions,
      tags
    } = versionsAndTags;

    if (range in tags) {
      range = tags[range];
    }

    return versions.includes(range) ? range : semver.maxSatisfying(versions, range);
  }

  return null;
}
/**
 * Check the package version/tag in the URL and make sure it's good. Also
 * fetch the package config and add it to req.packageConfig. Redirect to
 * the resolved version number if necessary.
 */


async function validateVersion(req, res, next) {
  const version = await resolveVersion(req.packageName, req.packageVersion, req.log);

  if (!version) {
    return res.status(404).type('text').send(`Cannot find package ${req.packageSpec}`);
  }

  if (version !== req.packageVersion) {
    return semverRedirect(req, res, version);
  }

  req.packageConfig = await getPackageConfig(req.packageName, req.packageVersion, req.log);

  if (!req.packageConfig) {
    return res.status(500).type('text').send(`Cannot get config for package ${req.packageSpec}`);
  }

  next();
}

var validatePackageVersion = asyncHandler(validateVersion);

function createApp(callback) {
  const app = express();
  callback(app);
  return app;
}

function createServer() {
  return createApp(app => {
    app.disable('x-powered-by');
    app.enable('trust proxy');
    app.enable('strict routing');

    if (process.env.NODE_ENV === 'development') {
      app.use(morgan('dev'));
    }

    app.use(cors());
    app.use(express.static('public', {
      maxAge: '1y'
    })); // Special startup request from App Engine
    // https://cloud.google.com/appengine/docs/standard/nodejs/how-instances-are-managed

    app.get('/_ah/start', (req, res) => {
      res.status(200).end();
    });
    app.use(requestLog);
    app.get('/', serveMainPage);
    app.get('/api/stats', serveStats);
    app.use(redirectLegacyURLs);
    app.use('/browse', createApp(app => {
      app.enable('strict routing');
      app.get('*/', noQuery(), validatePackagePathname, validatePackageName, validatePackageVersion, serveDirectoryBrowser$1);
      app.get('*', noQuery(), validatePackagePathname, validatePackageName, validatePackageVersion, serveFileBrowser$1);
    })); // We need to route in this weird way because Express
    // doesn't have a way to route based on query params.

    const metadataApp = createApp(app => {
      app.enable('strict routing');
      app.get('*/', allowQuery('meta'), validatePackagePathname, validatePackageName, validatePackageVersion, validateFilename, serveDirectoryMetadata$1);
      app.get('*', allowQuery('meta'), validatePackagePathname, validatePackageName, validatePackageVersion, validateFilename, serveFileMetadata$1);
    });
    app.use((req, res, next) => {
      if (req.query.meta != null) {
        metadataApp(req, res);
      } else {
        next();
      }
    }); // We need to route in this weird way because Express
    // doesn't have a way to route based on query params.

    const moduleApp = createApp(app => {
      app.enable('strict routing');
      app.get('*', allowQuery('module'), validatePackagePathname, validatePackageName, validatePackageVersion, validateFilename, findEntry$3, serveModule);
    });
    app.use((req, res, next) => {
      if (req.query.module != null) {
        moduleApp(req, res);
      } else {
        next();
      }
    }); // Send old */ requests to the new /browse UI.

    app.get('*/', (req, res) => {
      res.redirect(302, '/browse' + req.url);
    });
    app.get('*', noQuery(), validatePackagePathname, validatePackageName, validatePackageVersion, validateFilename, findEntry$3, serveFile);
  });
}

if (process.env.GAE_ENV === 'standard') {
  require('@google-cloud/trace-agent').start();
}
const server = createServer();
const port = process.env.PORT || '8080';
server.listen(port, () => {
  console.log('Server listening on port %s, Ctrl+C to quit', port);
});
