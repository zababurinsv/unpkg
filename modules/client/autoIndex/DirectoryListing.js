import React from 'react';
import PropTypes from 'prop-types';
import formatBytes from 'pretty-bytes';
import sortBy from 'sort-by';

function getDirname(name) {
  return (
    name
      .split('/')
      .slice(0, -1)
      .join('/') || '.'
  );
}

function getMatchingEntries(entry, entries) {
  const dirname = entry.name || '.';

  return Object.keys(entries)
    .filter(name => entry.name !== name && getDirname(name) === dirname)
    .map(name => entries[name]);
}

function getRelativeName(base, name) {
  return base.length ? name.substr(base.length + 1) : name;
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    font: '0.85em Monaco, monospace'
  },
  evenRow: {
    backgroundColor: '#eee'
  },
  tableHead: {
    textAlign: 'left',
    padding: '0.5em 1em'
  },
  tableCell: {
    padding: '0.5em 1em'
  }
};

export default function DirectoryListing({ filename, entry, entries }) {
  const rows = [];

  if (filename !== '/') {
    rows.push(
      <tr key="..">
        <td style={styles.tableCell}>
          <a title="Parent directory" href="../">
            ..
          </a>
        </td>
        <td style={styles.tableCell}>-</td>
        <td style={styles.tableCell}>-</td>
        <td style={styles.tableCell}>-</td>
      </tr>
    );
  }

  const matchingEntries = getMatchingEntries(entry, entries);

  matchingEntries
    .filter(({ type }) => type === 'directory')
    .sort(sortBy('name'))
    .forEach(({ name }) => {
      const relName = getRelativeName(entry.name, name);
      const href = relName + '/';

      rows.push(
        <tr key={name}>
          <td style={styles.tableCell}>
            <a title={relName} href={href}>
              {href}
            </a>
          </td>
          <td style={styles.tableCell}>-</td>
          <td style={styles.tableCell}>-</td>
          <td style={styles.tableCell}>-</td>
        </tr>
      );
    });

  matchingEntries
    .filter(({ type }) => type === 'file')
    .sort(sortBy('name'))
    .forEach(({ name, size, contentType, lastModified }) => {
      const relName = getRelativeName(entry.name, name);

      rows.push(
        <tr key={name}>
          <td style={styles.tableCell}>
            <a title={relName} href={relName}>
              {relName}
            </a>
          </td>
          <td style={styles.tableCell}>{contentType}</td>
          <td style={styles.tableCell}>{formatBytes(size)}</td>
          <td style={styles.tableCell}>{lastModified}</td>
        </tr>
      );
    });

  return (
    <div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHead}>Name</th>
            <th style={styles.tableHead}>Type</th>
            <th style={styles.tableHead}>Size</th>
            <th style={styles.tableHead}>Last Modified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) =>
            React.cloneElement(row, {
              style: index % 2 ? undefined : styles.evenRow
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

if (process.env.NODE_ENV !== 'production') {
  const entryType = PropTypes.shape({
    name: PropTypes.string.isRequired
  });

  DirectoryListing.propTypes = {
    filename: PropTypes.string.isRequired,
    entry: entryType.isRequired,
    entries: PropTypes.objectOf(entryType).isRequired
  };
}
