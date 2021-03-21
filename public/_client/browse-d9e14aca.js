'use strict';(function(n,y,c){function r(){r=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],e;for(e in c)Object.prototype.hasOwnProperty.call(c,e)&&(a[e]=c[e])}return a};return r.apply(this,arguments)}function O(a,b){if(null==a)return{};var c={},e=Object.keys(a),d;for(d=0;d<e.length;d++){var h=e[d];0<=b.indexOf(h)||(c[h]=a[h])}return c}function P(a,b){b||(b=a.slice(0));a.raw=b;return a}function C(a,b){return b={exports:{}},a(b,b.exports),b.exports}function I(a,b,
c,e,d){for(var f in a)if(ja(a,f)){try{if("function"!==typeof a[f]){var u=Error((e||"React class")+": "+c+" type `"+f+"` is invalid; it must be a function, usually from the `prop-types` package, but received `"+typeof a[f]+"`.");u.name="Invariant Violation";throw u;}var m=a[f](b,f,e,c,null,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED")}catch(ka){m=ka}!m||m instanceof Error||J((e||"React class")+": type specification of "+c+" `"+f+"` is invalid; the type checker function must return `null` or an `Error` but returned a "+
typeof m+". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).");if(m instanceof Error&&!(m.message in K)){K[m.message]=!0;var k=d?d():"";J("Failed "+c+" type: "+m.message+(null!=k?k:""))}}}function D(){return null}function Q(a){var b,f=a.children;a=a.css;return c.jsx("div",{css:r((b={border:"1px solid #dfe2e5",borderRadius:3},b["@media (max-width: 700px)"]={borderRightWidth:0,borderLeftWidth:0},
b),a)},f)}function R(a){var b,f=a.children;a=a.css;return c.jsx("div",{css:r((b={padding:10,background:"#f6f8fa",color:"#424242",border:"1px solid #d1d5da",borderTopLeftRadius:3,borderTopRightRadius:3,margin:"-1px -1px 0",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},b["@media (max-width: 700px)"]={paddingRight:20,paddingLeft:20},b),a)},f)}function S(a){return a&&a.map(function(a,c){return n.createElement(a.tag,v({key:c},a.attr),S(a.child))})}function A(a){return function(b){return n.createElement(la,
v({attr:v({},a.attr)},b),S(a.child))}}function la(a){var b=function(b){var c=a.size||b.size||"1em";if(b.className)var d=b.className;a.className&&(d=(d?d+" ":"")+a.className);var f=a.attr,u=a.title,m=ma(a,["attr","title"]);return n.createElement("svg",v({stroke:"currentColor",fill:"currentColor",strokeWidth:"0"},b.attr,f,m,{className:d,style:v({color:a.color||b.color},b.style,a.style),height:c,width:c,xmlns:"http://www.w3.org/2000/svg"}),u&&n.createElement("title",null,u),a.children)};return void 0!==
T?n.createElement(T.Consumer,null,function(a){return b(a)}):b(U)}function na(a){return A({tag:"svg",attr:{viewBox:"0 0 12 16"},child:[{tag:"path",attr:{fillRule:"evenodd",d:"M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM5 6.98L3.5 8.5 5 10l-.5 1L2 8.5 4.5 6l.5.98zM7.5 6L10 8.5 7.5 11l-.5-.98L8.5 8.5 7 7l.5-1z"}}]})(a)}function oa(a){return A({tag:"svg",attr:{viewBox:"0 0 14 16"},child:[{tag:"path",attr:{fillRule:"evenodd",d:"M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z"}}]})(a)}
function pa(a){return A({tag:"svg",attr:{viewBox:"0 0 12 16"},child:[{tag:"path",attr:{fillRule:"evenodd",d:"M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z"}}]})(a)}function qa(a){return A({tag:"svg",attr:{viewBox:"0 0 496 512"},child:[{tag:"path",attr:{d:"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"}}]})(a)}
function ra(a){return A({tag:"svg",attr:{viewBox:"0 0 512 512"},child:[{tag:"path",attr:{d:"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"}}]})(a)}
function B(a,b){var f=b.css;b=O(b,["css"]);return c.jsx(a,r({css:r({},f,{verticalAlign:"text-bottom"})},b))}function sa(a){return B(pa,a)}function ta(a){return B(na,a)}function ua(a){return B(oa,a)}function va(a){return B(ra,a)}function wa(a){return B(qa,a)}function V(a){var b=a.path,f=a.details,e=Object.keys(f).reduce(function(a,b){var c=a.subdirs,e=a.files;b=f[b];"directory"===b.type?c.push(b):"file"===b.type&&e.push(b);return a},{subdirs:[],files:[]});a=e.subdirs;e=e.files;a.sort(W("path"));e.sort(W("path"));
var d=[];"/"!==b&&d.push(c.jsx("tr",{key:".."},c.jsx("td",{css:L}),c.jsx("td",{css:w},c.jsx("a",{title:"Parent directory",href:"../",css:M},"..")),c.jsx("td",{css:w}),c.jsx("td",{css:N})));a.forEach(function(a){a=a.path.substr(1<b.length?b.length+1:1);var e=a+"/";d.push(c.jsx("tr",{key:a},c.jsx("td",{css:L},c.jsx(ua,null)),c.jsx("td",{css:w},c.jsx("a",{title:a,href:e,css:M},a)),c.jsx("td",{css:w},"-"),c.jsx("td",{css:N},"-")))});e.forEach(function(a){var e=a.size,f=a.contentType;a=a.path.substr(1<
b.length?b.length+1:1);d.push(c.jsx("tr",{key:a},c.jsx("td",{css:L},"text/plain"===f||"text/markdown"===f?c.jsx(sa,null):c.jsx(ta,null)),c.jsx("td",{css:w},c.jsx("a",{title:a,href:a,css:M},a)),c.jsx("td",{css:w},X(e)),c.jsx("td",{css:N},f)))});var h=[];0<e.length&&h.push(e.length+" file"+(1===e.length?"":"s"));0<a.length&&h.push(a.length+" folder"+(1===a.length?"":"s"));return c.jsx(Q,null,c.jsx(R,null,c.jsx("span",null,h.join(", "))),c.jsx("table",{css:{width:"100%",borderCollapse:"collapse",borderRadius:2,
background:"#fff","@media (max-width: 700px)":{"& th + th + th + th, & td + td + td + td":{display:"none"}},"& tr:first-of-type td":{borderTop:0}}},c.jsx("thead",null,c.jsx("tr",null,c.jsx("th",null,c.jsx(E,null,"Icon")),c.jsx("th",null,c.jsx(E,null,"Name")),c.jsx("th",null,c.jsx(E,null,"Size")),c.jsx("th",null,c.jsx(E,null,"Content Type")))),c.jsx("tbody",null,d)))}function xa(a){a=a.split("/");return a[a.length-1]}function ya(a){var b=a.uri;return c.jsx("div",{css:{padding:20,textAlign:"center"}},
c.jsx("img",{alt:xa(a.path),src:b}))}function za(a){a=a.highlights.slice(0);var b=a.length&&""===a[a.length-1];b&&a.pop();return c.jsx("div",{className:"code-listing",css:{overflowX:"auto",overflowY:"hidden",paddingTop:5,paddingBottom:5}},c.jsx("table",{css:{border:"none",borderCollapse:"collapse",borderSpacing:0}},c.jsx("tbody",null,a.map(function(a,b){var e=b+1;return c.jsx("tr",{key:b},c.jsx("td",{id:"L"+e,css:{paddingLeft:10,paddingRight:10,color:"rgba(27,31,35,.3)",textAlign:"right",verticalAlign:"top",
width:"1%",minWidth:50,userSelect:"none"}},c.jsx("span",null,e)),c.jsx("td",{id:"LC"+e,css:{paddingLeft:10,paddingRight:10,color:"#24292e",whiteSpace:"pre"}},c.jsx("code",{dangerouslySetInnerHTML:{__html:a}})))}),!b&&c.jsx("tr",{key:"no-newline"},c.jsx("td",{css:{paddingLeft:10,paddingRight:10,color:"rgba(27,31,35,.3)",textAlign:"right",verticalAlign:"top",width:"1%",minWidth:50,userSelect:"none"}},"\\"),c.jsx("td",{css:{paddingLeft:10,color:"rgba(27,31,35,.3)",userSelect:"none"}},"No newline at end of file")))))}
function Aa(){return c.jsx("div",{css:{padding:20}},c.jsx("p",{css:{textAlign:"center"}},"No preview available."))}function Y(a){var b=a.packageName,f=a.packageVersion,e=a.path;a=a.details;var d=a.highlights,h=a.uri,u=a.language;return c.jsx(Q,null,c.jsx(R,null,c.jsx("span",null,X(a.size)),c.jsx("span",null,u),c.jsx("span",null,c.jsx("a",{href:"/"+b+"@"+f+e,css:{display:"inline-block",marginLeft:8,padding:"2px 8px",textDecoration:"none",fontWeight:600,fontSize:"0.9rem",color:"#24292e",backgroundColor:"#eff3f6",
border:"1px solid rgba(27,31,35,.2)",borderRadius:3,":hover":{backgroundColor:"#e6ebf1",borderColor:"rgba(27,31,35,.35)"},":active":{backgroundColor:"#e9ecef",borderColor:"rgba(27,31,35,.35)",boxShadow:"inset 0 0.15em 0.3em rgba(27,31,35,.15)"}}},"View Raw"))),d?c.jsx(za,{highlights:d}):h?c.jsx(ya,{path:e,uri:h}):c.jsx(Aa,null))}function Z(a){var b=a.css;a=O(a,["css"]);return c.jsx("a",r({},a,{css:r({color:"#0076ff",textDecoration:"none",":hover":{textDecoration:"underline"}},b)}))}function Ba(){return c.jsx("header",
{css:{marginTop:"2rem"}},c.jsx("h1",{css:{textAlign:"center",fontSize:"3rem",letterSpacing:"0.05em"}},c.jsx("a",{href:"/",css:{color:"#000",textDecoration:"none"}},"UNPKG")))}function Ca(a){var b=a.packageName,f=a.packageVersion,e=a.availableVersions;a=a.filename;var d=[];if("/"===a)d.push(b);else{var h="/browse/"+b+"@"+f;d.push(c.jsx(Z,{href:h+"/"},b));b=a.replace(/^\/+/,"").replace(/\/+$/,"").split("/");a=b.pop();b.forEach(function(a){h+="/"+a;d.push(c.jsx(Z,{href:h+"/"},a))});d.push(a)}return c.jsx("header",
{css:{display:"flex",flexDirection:"row",alignItems:"center","@media (max-width: 700px)":{flexDirection:"column-reverse",alignItems:"flex-start"}}},c.jsx("h1",{css:{fontSize:"1.5rem",fontWeight:"normal",flex:1,wordBreak:"break-all"}},c.jsx("nav",null,d.map(function(a,b,e){return c.jsx(n.Fragment,{key:b},0!==b&&c.jsx("span",{css:{paddingLeft:5,paddingRight:5}},"/"),b===e.length-1?c.jsx("strong",null,a):a)}))),c.jsx(Da,{packageVersion:f,availableVersions:e,onChange:function(a){window.location.href=
window.location.href.replace("@"+f,"@"+a)}}))}function Da(a){var b=a.onChange;return c.jsx("p",{css:{marginLeft:20,"@media (max-width: 700px)":{marginLeft:0,marginBottom:0}}},c.jsx("label",null,"Version:"," ",c.jsx("select",{name:"version",defaultValue:a.packageVersion,onChange:function(a){b&&b(a.target.value)},css:{appearance:"none",cursor:"pointer",padding:"4px 24px 4px 8px",fontWeight:600,fontSize:"0.9em",color:"#24292e",border:"1px solid rgba(27,31,35,.2)",borderRadius:3,backgroundColor:"#eff3f6",
backgroundImage:"url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAAAXNSR0IArs4c6QAAARFJREFUKBVjZAACNS39RhBNKrh17WI9o4quoT3Dn78HSNUMUs/CzOTI/O7Vi4dCYpJ3/jP+92BkYGAlyiBGhm8MjIxJt65e3MQM0vDu9YvLYmISILYZELOBxHABRkaGr0yMzF23r12YDFIDNgDEePv65SEhEXENBkYGFSAXuyGMjF8Z/jOsvX3tYiFIDwgwQSgIaaijnvj/P8M5IO8HsjiY/f//D4b//88A1SQhywG9jQr09PS4v/1mPAeUUPzP8B8cJowMjL+Bqu6xMQmaXL164AuyDgwDQJLa2qYSP//9vARkCoMVMzK8YeVkNbh+9uxzMB+JwGoASF5Vx0jz/98/18BqmZi171w9D2EjaaYKEwAEK00XQLdJuwAAAABJRU5ErkJggg==)",
backgroundPosition:"right 8px center",backgroundRepeat:"no-repeat",backgroundSize:"auto 25%",":hover":{backgroundColor:"#e6ebf1",borderColor:"rgba(27,31,35,.35)"},":active":{backgroundColor:"#e9ecef",borderColor:"rgba(27,31,35,.35)",boxShadow:"inset 0 0.15em 0.3em rgba(27,31,35,.15)"}}},a.availableVersions.map(function(a){return c.jsx("option",{key:a,value:a},a)}))))}function Ea(a){var b=a.packageName,f=a.packageVersion;a=a.target;return"directory"===a.type?c.jsx(V,{path:a.path,details:a.details}):
"file"===a.type?c.jsx(Y,{packageName:b,packageVersion:f,path:a.path,details:a.details}):null}function aa(a){var b=a.packageName,f=a.packageVersion,e=a.availableVersions;e=void 0===e?[]:e;var d=a.filename;a=a.target;return c.jsx(n.Fragment,null,c.jsx(c.Global,{styles:Fa}),c.jsx(c.Global,{styles:Ga}),c.jsx("div",{css:{flex:"1 0 auto"}},c.jsx("div",{css:{maxWidth:940,padding:"0 20px",margin:"0 auto"}},c.jsx(Ba,null)),c.jsx("div",{css:{maxWidth:940,padding:"0 20px",margin:"0 auto"}},c.jsx(Ca,{packageName:b,
packageVersion:f,availableVersions:e,filename:d})),c.jsx("div",{css:{maxWidth:940,padding:"0 20px",margin:"0 auto","@media (max-width: 700px)":{padding:0,margin:0}}},c.jsx(Ea,{packageName:b,packageVersion:f,target:a}))),c.jsx("footer",{css:{marginTop:"5rem",background:"black",color:"#aaa"}},c.jsx("div",{css:{maxWidth:940,padding:"10px 20px",margin:"0 auto",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}},c.jsx("p",null,c.jsx("span",null,"Build: ","fd447fa")),
c.jsx("p",null,c.jsx("span",null,"\u00a9 ",(new Date).getFullYear()," UNPKG")),c.jsx("p",{css:{fontSize:"1.5rem"}},c.jsx("a",{href:"https://twitter.com/unpkg",css:{color:"#aaa",display:"inline-block",":hover":{color:"white"}}},c.jsx(va,null)),c.jsx("a",{href:"https://github.com/mjackson/unpkg",css:{color:"#aaa",display:"inline-block",":hover":{color:"white"},marginLeft:"1rem"}},c.jsx(wa,null))))))}var ba="default"in n?n["default"]:n;y=y&&Object.prototype.hasOwnProperty.call(y,"default")?y["default"]:
y;var Ha="undefined"!==typeof globalThis?globalThis:"undefined"!==typeof window?window:"undefined"!==typeof global?global:"undefined"!==typeof self?self:{},La=C(function(a,b){(function(){function a(a){if("object"===typeof a&&null!==a){var b=a.$$typeof;switch(b){case h:switch(a=a.type,a){case l:case q:case m:case n:case k:case x:return a;default:switch(a=a&&a.$$typeof,a){case g:case t:case F:case G:case p:return a;default:return b}}case u:return b}}}function c(b){return a(b)===q}var d="function"===
typeof Symbol&&Symbol.for,h=d?Symbol.for("react.element"):60103,u=d?Symbol.for("react.portal"):60106,m=d?Symbol.for("react.fragment"):60107,k=d?Symbol.for("react.strict_mode"):60108,n=d?Symbol.for("react.profiler"):60114,p=d?Symbol.for("react.provider"):60109,g=d?Symbol.for("react.context"):60110,l=d?Symbol.for("react.async_mode"):60111,q=d?Symbol.for("react.concurrent_mode"):60111,t=d?Symbol.for("react.forward_ref"):60112,x=d?Symbol.for("react.suspense"):60113,Ia=d?Symbol.for("react.suspense_list"):
60120,G=d?Symbol.for("react.memo"):60115,F=d?Symbol.for("react.lazy"):60116,Ja=d?Symbol.for("react.block"):60121,Ka=d?Symbol.for("react.fundamental"):60117,r=d?Symbol.for("react.responder"):60118,w=d?Symbol.for("react.scope"):60119,v=!1;b.AsyncMode=l;b.ConcurrentMode=q;b.ContextConsumer=g;b.ContextProvider=p;b.Element=h;b.ForwardRef=t;b.Fragment=m;b.Lazy=F;b.Memo=G;b.Portal=u;b.Profiler=n;b.StrictMode=k;b.Suspense=x;b.isAsyncMode=function(b){v||(v=!0,console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API."));
return c(b)||a(b)===l};b.isConcurrentMode=c;b.isContextConsumer=function(b){return a(b)===g};b.isContextProvider=function(b){return a(b)===p};b.isElement=function(a){return"object"===typeof a&&null!==a&&a.$$typeof===h};b.isForwardRef=function(b){return a(b)===t};b.isFragment=function(b){return a(b)===m};b.isLazy=function(b){return a(b)===F};b.isMemo=function(b){return a(b)===G};b.isPortal=function(b){return a(b)===u};b.isProfiler=function(b){return a(b)===n};b.isStrictMode=function(b){return a(b)===
k};b.isSuspense=function(b){return a(b)===x};b.isValidElementType=function(a){return"string"===typeof a||"function"===typeof a||a===m||a===q||a===n||a===k||a===x||a===Ia||"object"===typeof a&&null!==a&&(a.$$typeof===F||a.$$typeof===G||a.$$typeof===p||a.$$typeof===g||a.$$typeof===t||a.$$typeof===Ka||a.$$typeof===r||a.$$typeof===w||a.$$typeof===Ja)};b.typeOf=a})()}),ca=C(function(a){a.exports=La}),da=Object.getOwnPropertySymbols,Ma=Object.prototype.hasOwnProperty,Na=Object.prototype.propertyIsEnumerable,
Oa=function(){try{if(!Object.assign)return!1;var a=new String("abc");a[5]="de";if("5"===Object.getOwnPropertyNames(a)[0])return!1;var b={};for(a=0;10>a;a++)b["_"+String.fromCharCode(a)]=a;if("0123456789"!==Object.getOwnPropertyNames(b).map(function(a){return b[a]}).join(""))return!1;var c={};"abcdefghijklmnopqrst".split("").forEach(function(a){c[a]=a});return"abcdefghijklmnopqrst"!==Object.keys(Object.assign({},c)).join("")?!1:!0}catch(e){return!1}}()?Object.assign:function(a,b){if(null===a||void 0===
a)throw new TypeError("Object.assign cannot be called with null or undefined");var c=Object(a);for(var e,d=1;d<arguments.length;d++){var h=Object(arguments[d]);for(var k in h)Ma.call(h,k)&&(c[k]=h[k]);if(da){e=da(h);for(var m=0;m<e.length;m++)Na.call(h,e[m])&&(c[e[m]]=h[e[m]])}}return c},J=function(){},K={},ja=Function.call.bind(Object.prototype.hasOwnProperty);J=function(a){a="Warning: "+a;"undefined"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};I.resetWarningCache=function(){K=
{}};var Pa=Function.call.bind(Object.prototype.hasOwnProperty),z=function(){};z=function(a){a="Warning: "+a;"undefined"!==typeof console&&console.error(a);try{throw Error(a);}catch(b){}};var Qa=function(a,b){function c(a,b){return a===b?0!==a||1/a===1/b:a!==a&&b!==b}function e(a){this.message=a;this.stack=""}function d(a){function l(l,q,g,t,f,h,x){t=t||"<<anonymous>>";h=h||g;if("SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"!==x){if(b)throw l=Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"),
l.name="Invariant Violation",l;"undefined"!==typeof console&&(x=t+":"+g,!c[x]&&3>d&&(z("You are manually calling a React.PropTypes validation function for the `"+h+"` prop on `"+t+"`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details."),c[x]=!0,d++))}return null==q[g]?l?null===q[g]?new e("The "+f+" `"+h+"` is marked as required "+("in `"+t+
"`, but its value is `null`.")):new e("The "+f+" `"+h+"` is marked as required in "+("`"+t+"`, but its value is `undefined`.")):null:a(q,g,t,f,h)}var c={},d=0,g=l.bind(null,!1);g.isRequired=l.bind(null,!0);return g}function h(a){return d(function(b,l,c,d,g,f){b=b[l];return m(b)!==a?(b=n(b),new e("Invalid "+d+" `"+g+"` of type "+("`"+b+"` supplied to `"+c+"`, expected ")+("`"+a+"`."))):null})}function k(b){switch(typeof b){case "number":case "string":case "undefined":return!0;case "boolean":return!b;
case "object":if(Array.isArray(b))return b.every(k);if(null===b||a(b))return!0;var c=b&&(p&&b[p]||b["@@iterator"]);var l="function"===typeof c?c:void 0;if(l)if(c=l.call(b),l!==b.entries)for(;!(b=c.next()).done;){if(!k(b.value))return!1}else for(;!(b=c.next()).done;){if((b=b.value)&&!k(b[1]))return!1}else return!1;return!0;default:return!1}}function m(a){var b=typeof a;return Array.isArray(a)?"array":a instanceof RegExp?"object":"symbol"===b||a&&("Symbol"===a["@@toStringTag"]||"function"===typeof Symbol&&
a instanceof Symbol)?"symbol":b}function n(a){if("undefined"===typeof a||null===a)return""+a;var b=m(a);if("object"===b){if(a instanceof Date)return"date";if(a instanceof RegExp)return"regexp"}return b}function r(a){a=n(a);switch(a){case "array":case "object":return"an "+a;case "boolean":case "date":case "regexp":return"a "+a;default:return a}}var p="function"===typeof Symbol&&Symbol.iterator,g={array:h("array"),bool:h("boolean"),func:h("function"),number:h("number"),object:h("object"),string:h("string"),
symbol:h("symbol"),any:d(D),arrayOf:function(a){return d(function(b,c,l,d,g){if("function"!==typeof a)return new e("Property `"+g+"` of component `"+l+"` has invalid PropType notation inside arrayOf.");b=b[c];if(!Array.isArray(b))return b=m(b),new e("Invalid "+d+" `"+g+"` of type "+("`"+b+"` supplied to `"+l+"`, expected an array."));for(c=0;c<b.length;c++){var q=a(b,c,l,d,g+"["+c+"]","SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");if(q instanceof Error)return q}return null})},element:function(){return d(function(b,
c,d,g,f){b=b[c];return a(b)?null:(b=m(b),new e("Invalid "+g+" `"+f+"` of type "+("`"+b+"` supplied to `"+d+"`, expected a single ReactElement.")))})}(),elementType:function(){return d(function(a,b,c,d,g){a=a[b];return ca.isValidElementType(a)?null:(a=m(a),new e("Invalid "+d+" `"+g+"` of type "+("`"+a+"` supplied to `"+c+"`, expected a single ReactElement type.")))})}(),instanceOf:function(a){return d(function(b,c,d,l,g){if(!(b[c]instanceof a)){var q=a.name||"<<anonymous>>";b=b[c];b=b.constructor&&
b.constructor.name?b.constructor.name:"<<anonymous>>";return new e("Invalid "+l+" `"+g+"` of type "+("`"+b+"` supplied to `"+d+"`, expected ")+("instance of `"+q+"`."))}return null})},node:function(){return d(function(a,b,c,d,g){return k(a[b])?null:new e("Invalid "+d+" `"+g+"` supplied to "+("`"+c+"`, expected a ReactNode."))})}(),objectOf:function(a){return d(function(b,c,d,g,l){if("function"!==typeof a)return new e("Property `"+l+"` of component `"+d+"` has invalid PropType notation inside objectOf.");
b=b[c];c=m(b);if("object"!==c)return new e("Invalid "+g+" `"+l+"` of type "+("`"+c+"` supplied to `"+d+"`, expected an object."));for(var f in b)if(Pa(b,f)&&(c=a(b,f,d,g,l+"."+f,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"),c instanceof Error))return c;return null})},oneOf:function(a){return Array.isArray(a)?d(function(b,d,g,l,f){b=b[d];for(d=0;d<a.length;d++)if(c(b,a[d]))return null;d=JSON.stringify(a,function(a,b){return"symbol"===n(b)?String(b):b});return new e("Invalid "+l+" `"+f+"` of value `"+
String(b)+"` "+("supplied to `"+g+"`, expected one of "+d+"."))}):(1<arguments.length?z("Invalid arguments supplied to oneOf, expected an array, got "+arguments.length+" arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z])."):z("Invalid argument supplied to oneOf, expected an array."),D)},oneOfType:function(a){if(!Array.isArray(a))return z("Invalid argument supplied to oneOfType, expected an instance of array."),D;for(var b=0;b<a.length;b++){var c=a[b];if("function"!==
typeof c)return z("Invalid argument supplied to oneOfType. Expected an array of check functions, but received "+r(c)+" at index "+b+"."),D}return d(function(b,c,d,g,l){for(var f=0;f<a.length;f++)if(null==(0,a[f])(b,c,d,g,l,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"))return null;return new e("Invalid "+g+" `"+l+"` supplied to "+("`"+d+"`."))})},shape:function(a){return d(function(b,c,d,g,l){b=b[c];c=m(b);if("object"!==c)return new e("Invalid "+g+" `"+l+"` of type `"+c+"` "+("supplied to `"+d+"`, expected `object`."));
for(var f in a)if(c=a[f])if(c=c(b,f,d,g,l+"."+f,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"))return c;return null})},exact:function(a){return d(function(b,c,d,g,l){var f=b[c],h=m(f);if("object"!==h)return new e("Invalid "+g+" `"+l+"` of type `"+h+"` "+("supplied to `"+d+"`, expected `object`."));h=Oa({},b[c],a);for(var q in h){h=a[q];if(!h)return new e("Invalid "+g+" `"+l+"` key `"+q+"` supplied to `"+d+"`.\nBad object: "+JSON.stringify(b[c],null,"  ")+"\nValid keys: "+JSON.stringify(Object.keys(a),
null,"  "));if(h=h(f,q,d,g,l+"."+q,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"))return h}return null})}};e.prototype=Error.prototype;g.checkPropTypes=I;g.resetWarningCache=I.resetWarningCache;return g.PropTypes=g},k=C(function(a){a.exports=Qa(ca.isElement,!0)}),Ra=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],e;for(e in c)Object.prototype.hasOwnProperty.call(c,e)&&(a[e]=c[e])}return a},Sa={border:0,clip:"rect(0 0 0 0)",height:"1px",width:"1px",margin:"-1px",
padding:0,overflow:"hidden",position:"absolute"},E=function(a){return ba.createElement("div",Ra({style:Sa},a))},ea=C(function(a){(function(b,c){a.exports=c()})(Ha,function(){function a(a){if(!a)return!0;if(!d(a)||0!==a.length)for(var b in a)if(r.call(a,b))return!1;return!0}function c(a){return"number"===typeof a||"[object Number]"===n.call(a)}function e(a){return"string"===typeof a||"[object String]"===n.call(a)}function d(a){return"object"===typeof a&&"number"===typeof a.length&&"[object Array]"===
n.call(a)}function h(a){var b=parseInt(a);return b.toString()===a?b:a}function k(b,d,f,m){c(d)&&(d=[d]);if(a(d))return b;if(e(d))return k(b,d.split("."),f,m);var g=h(d[0]);if(1===d.length)return d=b[g],void 0!==d&&m||(b[g]=f),d;void 0===b[g]&&(c(g)?b[g]=[]:b[g]={});return k(b[g],d.slice(1),f,m)}function m(b,f){c(f)&&(f=[f]);if(!a(b)){if(a(f))return b;if(e(f))return m(b,f.split("."));var g=h(f[0]),l=b[g];if(1===f.length)void 0!==l&&(d(b)?b.splice(g,1):delete b[g]);else if(void 0!==b[g])return m(b[g],
f.slice(1));return b}}var n=Object.prototype.toString,r=Object.prototype.hasOwnProperty,p={ensureExists:function(a,b,c){return k(a,b,c,!0)},set:function(a,b,c,d){return k(a,b,c,d)},insert:function(a,b,c,e){var f=p.get(a,b);e=~~e;d(f)||(f=[],p.set(a,b,f));f.splice(e,0,c)},empty:function(b,f){if(a(f))return b;if(!a(b)){var g,h;if(!(g=p.get(b,f)))return b;if(e(g))return p.set(b,f,"");if("boolean"===typeof g||"[object Boolean]"===n.call(g))return p.set(b,f,!1);if(c(g))return p.set(b,f,0);if(d(g))g.length=
0;else if("object"===typeof g&&"[object Object]"===n.call(g))for(h in g)r.call(g,h)&&delete g[h];else return p.set(b,f,null)}},push:function(a,b){var c=p.get(a,b);d(c)||(c=[],p.set(a,b,c));c.push.apply(c,Array.prototype.slice.call(arguments,2))},coalesce:function(a,b,c){for(var d,e=0,f=b.length;e<f;e++)if(void 0!==(d=p.get(a,b[e])))return d;return c},get:function(b,d,f){c(d)&&(d=[d]);if(a(d))return b;if(a(b))return f;if(e(d))return p.get(b,d.split("."),f);var g=h(d[0]);return 1===d.length?void 0===
b[g]?f:b[g]:p.get(b[g],d.slice(1),f)},del:function(a,b){return m(a,b)}};return p})});var fa=function(a){return function(b){return typeof b===a}};var Ta=function(a,b){var c=1,e=b||function(a,b){return b};"-"===a[0]&&(c=-1,a=a.substr(1));return function(b,f){var d;b=e(a,ea.get(b,a));f=e(a,ea.get(f,a));b<f&&(d=-1);b>f&&(d=1);b===f&&(d=0);return d*c}};var W=function(){var a=Array.prototype.slice.call(arguments),b=a.filter(fa("string")),c=a.filter(fa("function"))[0];return function(a,d){for(var f=b.length,
e=0,k=0;0===e&&k<f;)e=Ta(b[k],c)(a,d),k++;return e}};let Ua="B kB MB GB TB PB EB ZB YB".split(" "),Va="B kiB MiB GiB TiB PiB EiB ZiB YiB".split(" "),Wa="b kbit Mbit Gbit Tbit Pbit Ebit Zbit Ybit".split(" "),Xa="b kibit Mibit Gibit Tibit Pibit Eibit Zibit Yibit".split(" "),ha=(a,b,c)=>{let e=a;if("string"===typeof b||Array.isArray(b))e=a.toLocaleString(b,c);else if(!0===b||void 0!==c)e=a.toLocaleString(void 0,c);return e};var X=(a,b)=>{if(!Number.isFinite(a))throw new TypeError(`Expected a finite number, got ${typeof a}: ${a}`);
b=Object.assign({bits:!1,binary:!1},b);let c=b.bits?b.binary?Xa:Wa:b.binary?Va:Ua;if(b.signed&&0===a)return` 0 ${c[0]}`;var e=0>a;let d=e?"-":b.signed?"+":"";e&&(a=-a);let h;void 0!==b.minimumFractionDigits&&(h={minimumFractionDigits:b.minimumFractionDigits});void 0!==b.maximumFractionDigits&&(h=Object.assign({maximumFractionDigits:b.maximumFractionDigits},h));if(1>a)return a=ha(a,b.locale,h),d+a+" "+c[0];e=Math.min(Math.floor(b.binary?Math.log(a)/Math.log(1024):Math.log10(a)/3),c.length-1);a/=Math.pow(b.binary?
1024:1E3,e);h||(a=a.toPrecision(3));a=ha(Number(a),b.locale,h);return d+a+" "+c[e]},U={color:void 0,size:void 0,className:void 0,style:void 0,attr:void 0},T=n.createContext&&n.createContext(U),v=window&&window.__assign||function(){v=Object.assign||function(a){for(var b,c=1,e=arguments.length;c<e;c++){b=arguments[c];for(var d in b)Object.prototype.hasOwnProperty.call(b,d)&&(a[d]=b[d])}return a};return v.apply(this,arguments)},ma=window&&window.__rest||function(a,b){var c={},e;for(e in a)Object.prototype.hasOwnProperty.call(a,
e)&&0>b.indexOf(e)&&(c[e]=a[e]);if(null!=a&&"function"===typeof Object.getOwnPropertySymbols){var d=0;for(e=Object.getOwnPropertySymbols(a);d<e.length;d++)0>b.indexOf(e[d])&&(c[e[d]]=a[e[d]])}return c},M={color:"#0076ff",textDecoration:"none",":hover":{textDecoration:"underline"}},w={paddingTop:6,paddingRight:3,paddingBottom:6,paddingLeft:3,borderTop:"1px solid #eaecef"},L=r({},w,{color:"#424242",width:17,paddingRight:2,paddingLeft:10,"@media (max-width: 700px)":{paddingLeft:20}}),N=r({},w,{textAlign:"right",
paddingRight:10,"@media (max-width: 700px)":{paddingRight:20}});V.propTypes={path:k.string.isRequired,details:k.objectOf(k.shape({path:k.string.isRequired,type:k.oneOf(["directory","file"]).isRequired,contentType:k.string,integrity:k.string,size:k.number})).isRequired};Y.propTypes={path:k.string.isRequired,details:k.shape({contentType:k.string.isRequired,highlights:k.arrayOf(k.string),uri:k.string,integrity:k.string.isRequired,language:k.string.isRequired,size:k.number.isRequired}).isRequired};var H,
ia,Fa=c.css(H||(H=P(["\n  html {\n    box-sizing: border-box;\n  }\n  *,\n  *:before,\n  *:after {\n    box-sizing: inherit;\n  }\n\n  html,\n  body,\n  #root {\n    height: 100%;\n    margin: 0;\n  }\n\n  body {\n    ","\n    font-size: 16px;\n    line-height: 1.5;\n    overflow-wrap: break-word;\n    background: white;\n    color: black;\n  }\n\n  code {\n    ","\n  }\n\n  th,\n  td {\n    padding: 0;\n  }\n\n  select {\n    font-size: inherit;\n  }\n\n  #root {\n    display: flex;\n    flex-direction: column;\n  }\n"])),
'\nfont-family: -apple-system,\n  BlinkMacSystemFont,\n  "Segoe UI",\n  "Roboto",\n  "Oxygen",\n  "Ubuntu",\n  "Cantarell",\n  "Fira Sans",\n  "Droid Sans",\n  "Helvetica Neue",\n  sans-serif;\n',"\nfont-family: Menlo,\n  Monaco,\n  Lucida Console,\n  Liberation Mono,\n  DejaVu Sans Mono,\n  Bitstream Vera Sans Mono,\n  Courier New,\n  monospace;\n"),Ga=c.css(ia||(ia=P(["\n  .code-listing {\n    background: #fbfdff;\n    color: #383a42;\n  }\n  .code-comment,\n  .code-quote {\n    color: #a0a1a7;\n    font-style: italic;\n  }\n  .code-doctag,\n  .code-keyword,\n  .code-link,\n  .code-formula {\n    color: #a626a4;\n  }\n  .code-section,\n  .code-name,\n  .code-selector-tag,\n  .code-deletion,\n  .code-subst {\n    color: #e45649;\n  }\n  .code-literal {\n    color: #0184bb;\n  }\n  .code-string,\n  .code-regexp,\n  .code-addition,\n  .code-attribute,\n  .code-meta-string {\n    color: #50a14f;\n  }\n  .code-built_in,\n  .code-class .code-title {\n    color: #c18401;\n  }\n  .code-attr,\n  .code-variable,\n  .code-template-variable,\n  .code-type,\n  .code-selector-class,\n  .code-selector-attr,\n  .code-selector-pseudo,\n  .code-number {\n    color: #986801;\n  }\n  .code-symbol,\n  .code-bullet,\n  .code-meta,\n  .code-selector-id,\n  .code-title {\n    color: #4078f2;\n  }\n  .code-emphasis {\n    font-style: italic;\n  }\n  .code-strong {\n    font-weight: bold;\n  }\n"])));
H=k.shape({path:k.string.isRequired,type:k.oneOf(["directory","file"]).isRequired,details:k.object.isRequired});aa.propTypes={packageName:k.string.isRequired,packageVersion:k.string.isRequired,availableVersions:k.arrayOf(k.string),filename:k.string.isRequired,target:H.isRequired};y.hydrate(ba.createElement(aa,window.__DATA__||{}),document.getElementById("root"))})(React,ReactDOM,emotionCore);