// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Y = require('yjs');
const Quill = require('quill');
const { QuillBinding } = require('y-quill');
const io = require('socket.io-client');
const i18n = require('../shared/i18n');

const MAX_CHARS = 5000;
const params = new URLSearchParams(window.location.search);

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

/**
 * Minimal markdown shortcuts: "# ", "## ", "### ", "- ", "1. ", "> " at the
 * start of a line convert to the matching rich format when space is typed.
 */
function attachMarkdownShortcuts(quill) {
  const RULES = [
    { re: /^# $/, format: { header: 1 } },
    { re: /^## $/, format: { header: 2 } },
    { re: /^### $/, format: { header: 3 } },
    { re: /^- $/, format: { list: 'bullet' } },
    { re: /^\* $/, format: { list: 'bullet' } },
    { re: /^1\. $/, format: { list: 'ordered' } },
    { re: /^> $/, format: { blockquote: true } },
  ];

  quill.on('text-change', (delta, oldDelta, source) => {
    if(source !== 'user') return;
    const inserted = delta.ops && delta.ops.some(op => op.insert === ' ');
    if(!inserted) return;

    const sel = quill.getSelection();
    if(!sel) return;
    const [line, offset] = quill.getLine(sel.index);
    if(!line) return;
    const prefix = line.domNode.textContent.slice(0, offset);

    for(const rule of RULES)
      if(rule.re.test(prefix)) {
        const lineStart = sel.index - offset;
        setTimeout(() => {
          quill.deleteText(lineStart, offset, 'user');
          const name = Object.keys(rule.format)[0];
          quill.formatLine(lineStart, 1, name, rule.format[name], 'user');
        }, 0);
        break;
      }
  });
}

function setup() { // eslint-disable-line no-unused-vars
  const url = params.get('url');
  const conf = params.get('conf');
  const key = params.get('key');
  const token = params.get('token');
  const title = params.get('title') || 'Notes';

  document.title = title;
  document.getElementById('title').textContent = title;

  const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: i18n.t('notePlaceholder'),
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block', 'clean'],
      ],
    },
  });
  attachMarkdownShortcuts(quill);

  const counter = document.getElementById('counter');
  const updateCounter = () => {
    const len = quill.getLength() - 1;
    counter.textContent = `${len} / ${MAX_CHARS}`;
    counter.className = len >= MAX_CHARS ? 'over' : '';
  };

  // Hard length cap for app performance
  quill.on('text-change', (delta, oldDelta, source) => {
    if(source === 'user' && quill.getLength() - 1 > MAX_CHARS)
      quill.deleteText(MAX_CHARS, quill.getLength());
    updateCounter();
  });

  const doc = new Y.Doc();
  const ytext = doc.getText('note');

  const socket = io(`${url}/${conf}`, {
    query: `console-token=${token}`,
    forceNew: true,
  });

  let ready = false;
  let snapTimer = null;

  const pushSnapshot = () => {
    snapTimer = null;
    const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    socket.emit('noteSnapshot', { key, snapshot, text: quill.getText().slice(0, MAX_CHARS) });
  };

  doc.on('update', (update, origin) => {
    if(!ready || origin === 'remote') return;
    socket.emit('noteUpdate', { key, update: Buffer.from(update).toString('base64') });
    if(snapTimer !== null) clearTimeout(snapTimer);
    snapTimer = setTimeout(pushSnapshot, 1200);
  });

  socket.on('noteUpdate', (data) => {
    if(!data || data.key !== key || !data.update) return;
    try {
      Y.applyUpdate(doc, Buffer.from(data.update, 'base64'), 'remote');
    } catch(e) {
      console.error(e);
    }
  });

  socket.on('noteSnapshot', (data) => {
    if(data && data.ok === false) setStatus(i18n.t('noteSaveFailed'));
    else setStatus('');
  });

  socket.once('connect', () => {
    socket.emit('noteFetch', { key });
    socket.once('noteFetch', ({ ok, snapshot }) => {
      if(ok && snapshot)
        try {
          Y.applyUpdate(doc, Buffer.from(snapshot, 'base64'), 'remote');
        } catch(e) {
          console.error(e);
        }

      // eslint-disable-next-line no-new
      new QuillBinding(ytext, quill);
      ready = true;
      window.__quill = quill; // test hook
      window.__noteReady = true;
      updateCounter();
      quill.focus();
      setStatus('');
    });
  });

  socket.on('error', () => setStatus(i18n.t('noteOffline')));
  socket.on('disconnect', () => setStatus(i18n.t('noteOffline')));
  socket.on('reconnect', () => setStatus(''));

  setStatus(i18n.t('loading'));
}
