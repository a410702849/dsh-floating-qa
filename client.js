window.__ModuleLoader__.load({
  id: 'dsh-floating-qa',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useState } = React;

    const NS = 'floating-qa';
    const STORE_KEY = 'dsh.floating-qa.v1';
    const POS_KEY = 'dsh.floating-qa.position.v1';
    const DEFAULT_MAX = 3;
    const HARD_MAX = 20;
    const MAX_TEXT = 100000;
    const DEFAULT_WIDTH = 259;
    const MIN_WIDTH = 130;
    const HEADER_GAP = 2;
    const EMPTY = Object.freeze([]);

    const zh = {
      pin: '悬浮此问答',
      unpin: '取消悬浮',
      limitReached: '已达到悬浮上限，请先在悬浮列表里移除一条，或调大上限。',
      extractFailed: '未能读取这条问答的文本内容。',
      title: '悬浮问答',
      settings: '设置',
      maxLabel: '最多显示',
      maxUnit: '条',
      clearAll: '取消所有悬浮',
      remove: '移除',
      close: '关闭',
      question: '问题',
      answer: '回答',
      qBadge: '问',
      aBadge: '答',
      cancelPin: '取消悬浮',
      noQuestion: '（无问题文本）',
      noAnswer: '（无回答文本）',
      dragHint: '拖动标题栏移动；点击条目查看全文',
      resizeHint: '拖动左边框调整宽度',
      resizeRightHint: '拖动右边框调整宽度',
    };

    const en = {
      pin: 'Pin this Q&A',
      unpin: 'Unpin',
      limitReached: 'Pinned-item limit reached. Remove one from the floating list or raise the limit first.',
      extractFailed: 'Could not read the text of this Q&A.',
      title: 'Floating Q&A',
      settings: 'Settings',
      maxLabel: 'Show up to',
      maxUnit: 'items',
      clearAll: 'Clear all pinned',
      remove: 'Remove',
      close: 'Close',
      question: 'Question',
      answer: 'Answer',
      qBadge: 'Q',
      aBadge: 'A',
      cancelPin: 'Unpin',
      noQuestion: '(No question text)',
      noAnswer: '(No answer text)',
      dragHint: 'Drag the title bar to move; click an item to read it in full',
      resizeHint: 'Drag the left edge to resize',
      resizeRightHint: 'Drag the right edge to resize',
    };

    function clampMax(value) {
      const number = Math.round(Number(value));
      if (!Number.isFinite(number)) return DEFAULT_MAX;
      return Math.max(1, Math.min(HARD_MAX, number));
    }

    function normalizeItem(value) {
      if (value === null || typeof value !== 'object') return null;
      if (typeof value.id !== 'string' || value.id === '') return null;
      return {
        id: value.id,
        question: typeof value.question === 'string' ? value.question : '',
        answer: typeof value.answer === 'string' ? value.answer : '',
        time: typeof value.time === 'number' ? value.time : Date.now(),
      };
    }

    function loadState() {
      const initial = { bySession: {}, max: DEFAULT_MAX, notice: '' };
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (!raw) return initial;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object') return initial;
        const max = clampMax(parsed.max);
        const bySession = {};
        const source = parsed.bySession;
        if (source !== null && typeof source === 'object') {
          for (const sessionId of Object.keys(source)) {
            const list = source[sessionId];
            if (!Array.isArray(list)) continue;
            const items = list.map(normalizeItem).filter(Boolean).slice(0, max);
            if (items.length > 0) bySession[sessionId] = items;
          }
        }
        return { bySession, max, notice: '' };
      } catch {
        return initial;
      }
    }

    function saveState(state) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify({
          version: 1,
          max: state.max,
          bySession: state.bySession,
        }));
      } catch {
        /* A full or unavailable localStorage must not break the UI. */
      }
    }

    function loadPosition() {
      try {
        const raw = window.localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object') return null;
        if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
        const width = Number.isFinite(parsed.width) ? parsed.width : DEFAULT_WIDTH;
        return { left: parsed.left, top: parsed.top, width };
      } catch {
        return null;
      }
    }

    function savePosition(position) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(position));
      } catch {
        /* Position is a convenience; ignore storage failures. */
      }
    }

    function createStore() {
      let state = loadState();
      let noticeTimer = 0;
      const listeners = new Set();

      const commit = (next, persist = true) => {
        state = next;
        if (persist) saveState(state);
        for (const listener of Array.from(listeners)) listener();
      };

      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
        pin(sessionId, item) {
          const list = state.bySession[sessionId] || EMPTY;
          if (list.some(entry => entry.id === item.id)) return 'duplicate';
          if (list.length >= state.max) return 'limit';
          const nextList = [item, ...list];
          commit({
            ...state,
            notice: '',
            bySession: { ...state.bySession, [sessionId]: nextList },
          });
          return 'ok';
        },
        remove(sessionId, id) {
          const list = state.bySession[sessionId] || EMPTY;
          const nextList = list.filter(entry => entry.id !== id);
          const bySession = { ...state.bySession };
          if (nextList.length === 0) delete bySession[sessionId];
          else bySession[sessionId] = nextList;
          commit({ ...state, bySession });
        },
        clear(sessionId) {
          if (!state.bySession[sessionId]) return;
          const bySession = { ...state.bySession };
          delete bySession[sessionId];
          commit({ ...state, notice: '', bySession });
        },
        setMax(value) {
          const max = clampMax(value);
          const bySession = {};
          for (const [sessionId, list] of Object.entries(state.bySession)) {
            const trimmed = list.slice(0, max);
            if (trimmed.length > 0) bySession[sessionId] = trimmed;
          }
          commit({ ...state, max, bySession });
        },
        setNotice(text) {
          if (noticeTimer) window.clearTimeout(noticeTimer);
          commit({ ...state, notice: text }, false);
          noticeTimer = window.setTimeout(() => {
            if (!state.notice) return;
            commit({ ...state, notice: '' }, false);
          }, 4200);
        },
      };
    }

    function textOf(block) {
      if (block === null || typeof block !== 'object') return '';
      if (typeof block.text === 'string' && (block.type === 'text' || block.kind === 'text')) {
        return block.text;
      }
      if (typeof block.content === 'string' && block.type === 'text') return block.content;
      return '';
    }

    function blocksText(blocks) {
      if (!Array.isArray(blocks)) return '';
      return blocks.map(textOf).filter(Boolean).join('\n\n').trim();
    }

    function contentText(content) {
      if (typeof content === 'string') return content.trim();
      if (!Array.isArray(content)) return '';
      return content.map(textOf).filter(Boolean).join('\n\n').trim();
    }

    function findAssistant(nodes, messageId) {
      if (!Array.isArray(nodes)) return null;
      const wanted = String(messageId);
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (node && node.kind === 'assistant' && String(node.messageId) === wanted) {
          return { node, index };
        }
      }
      return null;
    }

    function answerFor(nodes, messageId) {
      const found = findAssistant(nodes, messageId);
      if (!found) return '';
      return blocksText(found.node.blocks);
    }

    function questionFor(nodes, messageId) {
      const found = findAssistant(nodes, messageId);
      if (!found) return '';
      for (let index = found.index - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (node && node.kind === 'user') return contentText(node.content);
      }
      return '';
    }

    function clip(text) {
      if (typeof text !== 'string') return '';
      return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n\n…` : text;
    }

    function PinIcon({ filled }) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: 16,
        height: 16,
        fill: filled ? 'currentColor' : 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M9 3h6l-1.1 6.1L18 12.5V15H6v-2.5l4.1-3.4L9 3Z' }),
        h('path', { d: 'M12 15v6' })
      );
    }

    function PinAction(props) {
      const { messageId, sessionId, useStore, pin, remove, setNotice, t } = props;
      const snapshot = useStore(state => state);
      const items = sessionId ? (snapshot.bySession[sessionId] || EMPTY) : EMPTY;
      const pinned = items.some(item => item.id === String(messageId));
      const atLimit = !pinned && items.length >= snapshot.max;
      const answer = props.useChat(chat => answerFor(chat.legacy.nodes, messageId));
      const question = props.useChat(chat => questionFor(chat.legacy.nodes, messageId));
      const label = pinned ? t('unpin') : atLimit ? t('limitReached') : t('pin');

      const toggle = () => {
        if (pinned) {
          remove(sessionId, String(messageId));
          return;
        }
        if (atLimit) {
          setNotice(t('limitReached'));
          return;
        }
        if (!question && !answer) {
          setNotice(t('extractFailed'));
          return;
        }
        const result = pin(sessionId, {
          id: String(messageId),
          question: clip(question),
          answer: clip(answer),
          time: Date.now(),
        });
        if (result === 'limit') setNotice(t('limitReached'));
        if (result === 'duplicate') setNotice(t('limitReached'));
      };

      return h('button', {
        type: 'button',
        className: 'dsh-fqa-pin' + (pinned ? ' is-pinned' : ''),
        title: label,
        'aria-label': label,
        'aria-pressed': pinned,
        onClick: toggle,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          padding: 0,
          border: 'none',
          borderRadius: 'var(--dsw-radius-sm, 6px)',
          background: 'transparent',
          color: pinned
            ? 'var(--dsw-alias-button-primary-fill, #4167d8)'
            : 'var(--dsw-alias-label-tertiary, #8a8f98)',
          cursor: atLimit ? 'not-allowed' : 'pointer',
          opacity: atLimit ? 0.4 : 1,
        },
      }, h(PinIcon, { filled: pinned }));
    }

    function findOverlayLayer(panel) {
      if (panel && typeof panel.closest === 'function') {
        const layer = panel.closest('[data-shell-overlay]');
        if (layer) return layer;
      }
      if (typeof document === 'undefined') return null;
      return document.querySelector('[data-shell-overlay]');
    }

    function readSidebarWidth(panel) {
      const layer = findOverlayLayer(panel);
      const frame = layer && layer.parentElement;
      if (!frame) return null;
      const tracks = window.getComputedStyle(frame).gridTemplateColumns;
      const first = Number.parseFloat(String(tracks).split(' ')[0]);
      if (Number.isFinite(first)) return first;
      const sidebar = frame.querySelector('[class*="sidebarCol"]');
      return sidebar && sidebar.getBoundingClientRect
        ? sidebar.getBoundingClientRect().width
        : null;
    }

    function readHeaderBottom(panel) {
      const layer = findOverlayLayer(panel);
      const frame = layer && layer.parentElement;
      if (!frame) return null;
      const header = frame.querySelector('header[data-window-drag]') || frame.querySelector('header');
      if (!header || !header.getBoundingClientRect) return null;
      const bottom = header.getBoundingClientRect().bottom;
      return Number.isFinite(bottom) ? bottom : null;
    }

    function clampPanelPosition(position, headerBottom) {
      const hasWindow = typeof window !== 'undefined';
      const viewportWidth = hasWindow && Number.isFinite(window.innerWidth)
        ? Math.max(1, window.innerWidth)
        : 1200;
      const viewportHeight = hasWindow && Number.isFinite(window.innerHeight)
        ? Math.max(1, window.innerHeight)
        : 800;
      const rawWidth = Number.isFinite(position.width) ? position.width : DEFAULT_WIDTH;
      const width = Math.min(viewportWidth, Math.max(MIN_WIDTH, rawWidth));
      const rawLeft = Number.isFinite(position.left) ? position.left : 0;
      const left = Math.max(0, Math.min(rawLeft, viewportWidth - width));
      const maxTop = Math.max(0, viewportHeight - 80);
      const bottom = Number.isFinite(headerBottom) ? headerBottom : 84;
      const minTop = Math.min(maxTop, Math.max(0, Math.round(bottom + HEADER_GAP)));
      const rawTop = Number.isFinite(position.top) ? position.top : minTop;
      const top = Math.max(minTop, Math.min(rawTop, maxTop));
      return { left, top, width };
    }

    function FloatingPanel(props) {
      const { useStore, remove, setMax, clear, t, useSessions } = props;
      const snapshot = useStore(state => state);
      const sessionId = useSessions(state => {
        const rows = Object.values(state.byId || {});
        const main = rows.find(row => row && row.retainedBy && (row.retainedBy.mainView || 0) > 0);
        return main ? main.id : undefined;
      });
      const items = sessionId ? (snapshot.bySession[sessionId] || EMPTY) : EMPTY;
      const [openId, setOpenId] = useState(null);
      const [settingsBySession, setSettingsBySession] = useState({});
      const [position, setPosition] = useState(() => loadPosition());
      const [sidebar, setSidebar] = useState(() => readSidebarWidth(null) ?? 280);
      const [headerBottom, setHeaderBottom] = useState(() => readHeaderBottom(null) ?? 84);
      const [dragging, setDragging] = useState(false);
      const [resizing, setResizing] = useState(false);
      const panelRef = useRef(null);
      const positionRef = useRef(position);
      const dragRef = useRef(null);
      const resizeRef = useRef(null);
      const headerBottomRef = useRef(headerBottom);
      headerBottomRef.current = headerBottom;

      const updatePosition = next => {
        positionRef.current = next;
        setPosition(next);
      };

      useEffect(() => {
        if (items.length === 0) return undefined;
        const measure = () => {
          const width = readSidebarWidth(panelRef.current);
          if (width !== null) {
            setSidebar(current => (Math.abs(current - width) < 0.5 ? current : width));
          }
          const bottom = readHeaderBottom(panelRef.current);
          if (bottom !== null) {
            headerBottomRef.current = bottom;
            setHeaderBottom(current => (Math.abs(current - bottom) < 0.5 ? current : bottom));
          }
          const base = positionRef.current;
          if (base) {
            const next = clampPanelPosition(base, bottom !== null ? bottom : headerBottomRef.current);
            if (next.left !== base.left || next.top !== base.top || next.width !== base.width) {
              positionRef.current = next;
              setPosition(next);
            }
          }
        };
        measure();
        window.addEventListener('resize', measure);
        const layer = findOverlayLayer(panelRef.current);
        const frame = layer && layer.parentElement;
        let observer = null;
        let headerObserver = null;
        if (frame && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure);
          observer.observe(frame);
          const header = frame.querySelector('header[data-window-drag]') || frame.querySelector('header');
          if (header) {
            headerObserver = new ResizeObserver(measure);
            headerObserver.observe(header);
          }
        }
        return () => {
          window.removeEventListener('resize', measure);
          if (observer) observer.disconnect();
          if (headerObserver) headerObserver.disconnect();
        };
      }, [items.length]);

      useEffect(() => {
        if (!openId) return undefined;
        const onKeyDown = event => {
          if (event.key === 'Escape') setOpenId(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [openId]);

      useEffect(() => {
        if (openId && !items.some(item => item.id === openId)) setOpenId(null);
      }, [items, openId]);

      if (!sessionId || items.length === 0) return null;

      const base = position || {
        left: Math.round(sidebar + 2),
        top: Math.round(headerBottom + HEADER_GAP),
        width: DEFAULT_WIDTH,
      };
      const current = clampPanelPosition(base, headerBottom);

      const settings = settingsBySession[sessionId] === true;
      const setSettings = value => {        setSettingsBySession(previous => {
          const wasOpen = previous[sessionId] === true;
          const nextOpen = typeof value === 'function' ? value(wasOpen) : value;
          if (nextOpen === wasOpen) return previous;
          const next = { ...previous };
          if (nextOpen) next[sessionId] = true;
          else delete next[sessionId];
          return next;
        });
      };

      const startDrag = event => {
        if (event.button !== 0) return;
        const target = event.target;
        if (target && target.closest && target.closest('button')) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragRef.current = {
          dx: event.clientX - rect.left,
          dy: event.clientY - rect.top,
        };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      };

      const moveDrag = event => {
        if (!dragRef.current) return;
        const width = positionRef.current ? positionRef.current.width : current.width;
        const height = panelRef.current ? panelRef.current.offsetHeight : 200;
        const minTop = Math.max(0, Math.round(headerBottom + HEADER_GAP));
        const maxTop = Math.max(minTop, window.innerHeight - height);
        const left = Math.max(0, Math.min(window.innerWidth - width, event.clientX - dragRef.current.dx));
        const top = Math.max(minTop, Math.min(maxTop, event.clientY - dragRef.current.dy));
        updatePosition({ left, top, width });
        event.preventDefault();
      };

      const endDrag = event => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        if (positionRef.current) savePosition(positionRef.current);
        if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      };

      const startResize = (event, side) => {
        if (event.button !== 0) return;
        const rect = panelRef.current.getBoundingClientRect();
        resizeRef.current = { side, left: rect.left, right: rect.right };
        setResizing(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      };

      const moveResize = event => {
        if (!resizeRef.current) return;
        const state = resizeRef.current;
        const top = positionRef.current ? positionRef.current.top : current.top;
        if (state.side === 'right') {
          const left = Math.max(0, state.left);
          const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - left);
          const width = Math.max(MIN_WIDTH, Math.min(maxWidth, event.clientX - left));
          updatePosition({ left, top, width });
        } else {
          const right = state.right;
          const maxWidth = Math.max(MIN_WIDTH, Math.min(window.innerWidth, right));
          const width = Math.max(MIN_WIDTH, Math.min(maxWidth, right - event.clientX));
          const left = Math.max(0, Math.min(window.innerWidth - width, right - width));
          updatePosition({ left, top, width });
        }
        event.preventDefault();
      };

      const resizeByKeyboard = (event, side) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const step = 12;
        const top = positionRef.current ? positionRef.current.top : current.top;
        if (side === 'right') {
          const grow = event.key === 'ArrowRight' ? step : -step;
          const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - current.left);
          const width = Math.max(MIN_WIDTH, Math.min(maxWidth, current.width + grow));
          updatePosition({ left: current.left, top, width });
        } else {
          const grow = event.key === 'ArrowLeft' ? step : -step;
          const right = current.left + current.width;
          const maxWidth = Math.max(MIN_WIDTH, Math.min(window.innerWidth, right));
          const width = Math.max(MIN_WIDTH, Math.min(maxWidth, current.width + grow));
          const left = Math.max(0, right - width);
          updatePosition({ left, top, width });
        }
        if (positionRef.current) savePosition(positionRef.current);
        event.preventDefault();
        event.stopPropagation();
      };

      const endResize = event => {
        if (!resizeRef.current) return;
        resizeRef.current = null;
        setResizing(false);
        if (positionRef.current) savePosition(positionRef.current);
        if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      };

      const openItem = openId ? items.find(item => item.id === openId) : null;
      const maxOptions = [];
      for (let value = 1; value <= HARD_MAX; value += 1) maxOptions.push(value);

      const panel = h('div', {
        ref: panelRef,
        className: 'dsh-fqa-panel'
          + (dragging ? ' is-dragging' : '')
          + (resizing ? ' is-resizing' : ''),
        style: { left: current.left, top: current.top, width: current.width },
      },
        h('style', null, CSS),
        h('div', {
          className: 'dsh-fqa-resize dsh-fqa-resize-left',
          role: 'separator',
          'aria-orientation': 'vertical',
          'aria-label': t('resizeHint'),
          title: t('resizeHint'),
          tabIndex: 0,
          onPointerDown: event => startResize(event, 'left'),
          onPointerMove: moveResize,
          onPointerUp: endResize,
          onPointerCancel: endResize,
          onKeyDown: event => resizeByKeyboard(event, 'left'),
        }),
        h('div', {
          className: 'dsh-fqa-resize dsh-fqa-resize-right',
          role: 'separator',
          'aria-orientation': 'vertical',
          'aria-label': t('resizeRightHint'),
          title: t('resizeRightHint'),
          tabIndex: 0,
          onPointerDown: event => startResize(event, 'right'),
          onPointerMove: moveResize,
          onPointerUp: endResize,
          onPointerCancel: endResize,
          onKeyDown: event => resizeByKeyboard(event, 'right'),
        }),
        h('div', {
          className: 'dsh-fqa-head',
          onPointerDown: startDrag,
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          title: t('dragHint'),
        },
          h('span', { className: 'dsh-fqa-title' },
            h('span', { className: 'dsh-fqa-title-icon' }, h(PinIcon, { filled: true })),
            t('title')
          ),
          h('span', { className: 'dsh-fqa-count' }, `${items.length}/${snapshot.max}`),
          h('button', {
            type: 'button',
            className: 'dsh-fqa-iconbtn',
            title: t('settings'),
            'aria-label': t('settings'),
            'aria-expanded': settings,
            onPointerDown: event => event.stopPropagation(),
            onClick: () => setSettings(value => !value),
          }, '⚙')
        ),
        settings && h('div', { className: 'dsh-fqa-settings' },
          h('span', null, t('maxLabel')),
          h('select', {
            className: 'dsh-fqa-select',
            value: snapshot.max,
            'aria-label': t('maxLabel'),
            onChange: event => setMax(Number(event.target.value)),
          }, maxOptions.map(value => h('option', { key: value, value }, value))),
          h('span', null, t('maxUnit')),
          h('button', {
            type: 'button',
            className: 'dsh-fqa-clear',
            title: t('clearAll'),
            onClick: () => clear(sessionId),
          }, t('clearAll'))
        ),
        snapshot.notice && h('div', { className: 'dsh-fqa-notice', role: 'status' }, snapshot.notice),
        h('div', { className: 'dsh-fqa-list' },
          items.map(item => h('div', {
            key: item.id,
            className: 'dsh-fqa-item',
            role: 'button',
            tabIndex: 0,
            onClick: () => setOpenId(item.id),
            onKeyDown: event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpenId(item.id);
              }
            },
          },
            h('div', { className: 'dsh-fqa-row dsh-fqa-question' },
              h('span', { className: 'dsh-fqa-badge' }, t('qBadge')),
              h('span', { className: 'dsh-fqa-one' }, item.question || t('noQuestion'))
            ),
            h('div', { className: 'dsh-fqa-row dsh-fqa-answer' },
              h('span', { className: 'dsh-fqa-badge' }, t('aBadge')),
              h('span', { className: 'dsh-fqa-one' }, item.answer || t('noAnswer'))
            ),
            h('button', {
              type: 'button',
              className: 'dsh-fqa-remove',
              title: t('remove'),
              'aria-label': t('remove'),
              onKeyDown: event => event.stopPropagation(),
              onClick: event => {
                event.stopPropagation();
                remove(sessionId, item.id);
              },
            }, '×')
          ))
        )
      );

      const modal = openItem && h('div', {
        className: 'dsh-fqa-mask',
        onMouseDown: event => {
          if (event.target === event.currentTarget) setOpenId(null);
        },
      },
        h('div', { className: 'dsh-fqa-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
          h('div', { className: 'dsh-fqa-modal-head' },
            h('strong', null, t('title')),
            h('button', {
              type: 'button',
              className: 'dsh-fqa-iconbtn',
              title: t('close'),
              'aria-label': t('close'),
              onClick: () => setOpenId(null),
            }, '×')
          ),
          h('div', { className: 'dsh-fqa-modal-body' },
            h('div', { className: 'dsh-fqa-section dsh-fqa-section-question' },
              h('div', { className: 'dsh-fqa-section-label' }, t('question')),
              h('div', { className: 'dsh-fqa-full' }, openItem.question || t('noQuestion'))
            ),
            h('div', { className: 'dsh-fqa-section' },
              h('div', { className: 'dsh-fqa-section-label' }, t('answer')),
              h('div', { className: 'dsh-fqa-full' }, openItem.answer || t('noAnswer'))
            )
          ),
          h('div', { className: 'dsh-fqa-modal-foot' },
            h('button', {
              type: 'button',
              className: 'dsh-fqa-secondary',
              onClick: () => {
                remove(sessionId, openItem.id);
                setOpenId(null);
              },
            }, t('cancelPin')),
            h('button', {
              type: 'button',
              className: 'dsh-fqa-primary',
              onClick: () => setOpenId(null),
            }, t('close'))
          )
        )
      );

      return h(React.Fragment, null, panel, modal);
    }

    const CSS = `
.dsh-fqa-panel {
  position: fixed;
  z-index: 60;
  pointer-events: auto;
  box-sizing: border-box;
  max-width: 100vw;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  border: 1px solid var(--dsw-alias-border-l2, rgba(120, 125, 140, .24));
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(15, 20, 35, .22), 0 2px 8px rgba(15, 20, 35, .12);
  overflow: hidden;
  font-size: 12px;
  line-height: 1.45;
  user-select: none;
}
.dsh-fqa-resize {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 7px;
  cursor: ew-resize;
  touch-action: none;
  outline: none;
}
.dsh-fqa-resize::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  width: 2px;
  height: 34px;
  transform: translateY(-50%);
  border-radius: 2px;
  background: var(--dsw-alias-border-l2, rgba(120, 125, 140, .4));
  opacity: 0;
  transition: opacity .12s ease;
}
.dsh-fqa-resize:hover::after,
.dsh-fqa-resize:focus-visible::after,
.dsh-fqa-panel.is-resizing .dsh-fqa-resize::after {
  opacity: 1;
  background: var(--dsw-alias-button-primary-fill, #4167d8);
}
.dsh-fqa-resize:focus-visible {
  box-shadow: inset 2px 0 0 var(--dsw-alias-button-primary-fill, #4167d8);
}
.dsh-fqa-resize-right {
  left: auto;
  right: 0;
  top: 36px;
}
.dsh-fqa-resize-right::after {
  left: auto;
  right: 2px;
}
.dsh-fqa-resize-right:focus-visible {
  box-shadow: inset -2px 0 0 var(--dsw-alias-button-primary-fill, #4167d8);
}
.dsh-fqa-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 8px 0 10px;
  cursor: grab;
  touch-action: none;
  background: linear-gradient(180deg, var(--dsw-alias-bg-layer-2, #f7f8fb), var(--dsw-alias-bg-layer-1, #fff));
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
}
.dsh-fqa-panel.is-dragging .dsh-fqa-head { cursor: grabbing; }
.dsh-fqa-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--dsw-alias-label-primary, #202124);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-fqa-title-icon {
  display: inline-flex;
  color: var(--dsw-alias-button-primary-fill, #4167d8);
  transform: rotate(28deg);
}
.dsh-fqa-count {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  background: var(--dsw-alias-bg-base, #fff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
}
.dsh-fqa-iconbtn {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.dsh-fqa-iconbtn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(120, 125, 140, .14));
  color: var(--dsw-alias-label-primary, #202124);
}
.dsh-fqa-settings {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 7px 10px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  background: var(--dsw-alias-bg-layer-2, #f7f8fb);
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
  font-size: 11.5px;
}
.dsh-fqa-clear {
  margin-left: auto;
  height: 23px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(120, 125, 140, .3));
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-state-error-primary, #c33);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-fqa-clear:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c33) 10%, transparent);
  border-color: var(--dsw-alias-state-error-primary, #c33);
}
.dsh-fqa-select {
  height: 24px;
  padding: 0 4px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(120, 125, 140, .3));
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font-size: 11.5px;
}
.dsh-fqa-notice {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--dsw-alias-state-warn-primary, #9a6700);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d4a72c) 12%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
}
.dsh-fqa-list {
  max-height: 204px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-right: 7px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh-fqa-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  cursor: pointer;
  outline: none;
}
.dsh-fqa-item:hover,
.dsh-fqa-item:focus-visible {
  border-color: var(--dsw-alias-button-primary-fill, #4167d8);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-button-primary-fill, #4167d8) 28%, transparent);
}
.dsh-fqa-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 22px;
  padding: 0 18px 0 6px;
  border-radius: 5px;
  font-size: 11.5px;
}
.dsh-fqa-question {
  color: var(--dsw-alias-label-primary, #202124);
  background: color-mix(in srgb, var(--dsw-alias-button-primary-fill, #4167d8) 13%, transparent);
  font-weight: 550;
}
.dsh-fqa-answer {
  color: var(--dsw-alias-label-secondary, #6b7280);
  background: var(--dsw-alias-bg-layer-2, #f7f8fb);
}
.dsh-fqa-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  font-size: 9px;
  line-height: 1;
}
.dsh-fqa-question .dsh-fqa-badge {
  color: #fff;
  background: var(--dsw-alias-button-primary-fill, #4167d8);
}
.dsh-fqa-answer .dsh-fqa-badge {
  color: var(--dsw-alias-label-secondary, #6b7280);
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.dsh-fqa-one {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dsh-fqa-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 17px;
  height: 17px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.dsh-fqa-item:hover .dsh-fqa-remove,
.dsh-fqa-item:focus-within .dsh-fqa-remove { opacity: 1; }
.dsh-fqa-remove:hover {
  color: var(--dsw-alias-state-error-primary, #d33);
  background: var(--dsw-alias-interactive-bg-hover, rgba(120, 125, 140, .14));
}
.dsh-fqa-list::-webkit-scrollbar { width: 8px; }
.dsh-fqa-list::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2, rgba(120, 125, 140, .35));
  border-radius: 999px;
}
.dsh-fqa-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(12, 16, 28, .48);
  backdrop-filter: blur(3px);
}
.dsh-fqa-modal {
  width: min(760px, 92vw);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  border: 1px solid var(--dsw-alias-border-l2, rgba(120, 125, 140, .24));
  border-radius: 14px;
  box-shadow: 0 24px 70px rgba(8, 12, 24, .35);
  overflow: hidden;
  user-select: text;
}
.dsh-fqa-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
  background: var(--dsw-alias-bg-layer-2, #f7f8fb);
}
.dsh-fqa-modal-head strong { font-size: 13px; font-weight: 650; }
.dsh-fqa-modal-body {
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dsh-fqa-section {
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #fff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
}
.dsh-fqa-section-question {
  background: color-mix(in srgb, var(--dsw-alias-button-primary-fill, #4167d8) 10%, transparent);
}
.dsh-fqa-section-label {
  margin-bottom: 6px;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
}
.dsh-fqa-full {
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsh-fqa-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(120, 125, 140, .16));
  background: var(--dsw-alias-bg-layer-2, #f7f8fb);
}
.dsh-fqa-primary,
.dsh-fqa-secondary {
  height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(120, 125, 140, .3));
  font-size: 12px;
  cursor: pointer;
}
.dsh-fqa-primary {
  color: #fff;
  background: var(--dsw-alias-button-primary-fill, #4167d8);
  border-color: transparent;
}
.dsh-fqa-secondary {
  color: var(--dsw-alias-label-primary, #202124);
  background: var(--dsw-alias-bg-base, #fff);
}
`;

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const store = createStore();
        ctx.effect(() => ctx.locale.register(NS, { zh, en }));

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'floating-qa.pin',
          order: 20,
          locale: NS,
          inject: () => ({
            hooks: { store },
            pin: (sessionId, item) => store.pin(sessionId, item),
            remove: (sessionId, id) => store.remove(sessionId, id),
            setMax: value => store.setMax(value),
            setNotice: text => store.setNotice(text),
          }),
        }, PinAction));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'floating-qa.panel',
          order: 20,
          locale: NS,
          inject: () => ({
            hooks: { store },
            remove: (sessionId, id) => store.remove(sessionId, id),
            setMax: value => store.setMax(value),
            clear: sessionId => store.clear(sessionId),
          }),
        }, FloatingPanel));
      },
    };
  },
});
