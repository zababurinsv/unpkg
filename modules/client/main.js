import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import { Global, css } from '@emotion/core';

import App from './main/App';

const globalStyles = css`
  body {
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif;
    line-height: 1.7;
    padding: 5px 20px;
    color: #000000;
  }

  @media (min-width: 800px) {
    body {
      padding: 40px 20px 120px;
    }
  }

  a:link {
    color: blue;
  }
  a:visited {
    color: rebeccapurple;
  }

  h1 {
    font-size: 2em;
  }
  h2 {
    font-size: 1.8em;
  }
  h3 {
    font-size: 1.6em;
  }

  ul {
    padding-left: 25px;
  }

  dd {
    margin-left: 25px;
  }

  table {
    border: 1px solid black;
    border: 0;
  }
  th {
    text-align: left;
    background-color: #eee;
  }
  th,
  td {
    padding: 5px;
  }
  th {
    vertical-align: bottom;
  }
  td {
    vertical-align: top;
  }

  .wrapper {
    max-width: 700px;
    margin: 0 auto;
  }
`;

ReactDOM.render(
  <HashRouter>
    <div>
      <Global styles={globalStyles} />
      <App />
    </div>
  </HashRouter>,
  document.getElementById('root')
);
