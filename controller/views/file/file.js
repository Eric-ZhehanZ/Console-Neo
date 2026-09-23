const Vue = require('vue');
const fs = require('fs');
const { dialog } = require('@electron/remote');
const { shell } = require('electron');

const util = require('../../../shared/util.js');

const FileView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/file.html`).toString('utf-8'),
  props: [
    'file',
    'authorized',
  ],

  data: () => ({
    type: 'download',
    rendered: '',
    zoom: 1,
  }),

  activate(done) {
    this.$dispatch('get-file', this.file.id, (err, cont) => {
      if(err) return alert(this.t('errLoad'));
      else {
        this.type = util.getFileType(this.file.type);
        this.fileCont = cont;
        this.zoom = 1;

        if(this.type === 'pdf') {
          this.clearPDF();
          return this.renderFit().then(done);
        } else if(this.type === 'image')
          return done();
        else
          // Display download link
          return done();
      }
    });
  },

  methods: {
    clearPDF() {
      while(this.$els.pages.firstChild)
        this.$els.pages.removeChild(this.$els.pages.firstChild);
    },

    renderFit(target) {
      // The view may not be laid out yet during activate; fall back to the window
      const container = this.$el.querySelector('.file-container');
      let base = container ? container.clientWidth : 0;
      if(!base) base = window.innerWidth;

      const width = Math.max(base * 0.68 * this.zoom, 240);
      return util.renderPDF(this.fileCont, -1, target || this.$els.pages, width);
    },

    fileScrollRatio() {
      const container = this.$el.querySelector('.file-container');
      if(!container) return 0;
      const range = container.scrollHeight - container.clientHeight;
      return range > 0 ? container.scrollTop / range : 0;
    },

    replacePDF(rendered, ratio) {
      this.clearPDF();
      while(rendered.firstChild)
        this.$els.pages.appendChild(rendered.firstChild);

      const container = this.$el.querySelector('.file-container');
      if(!container) return;
      const range = container.scrollHeight - container.clientHeight;
      container.scrollTop = ratio * Math.max(range, 0);
    },

    zoomIn() {
      this.applyZoom(Math.min(this.zoom + 0.25, 3));
    },

    zoomOut() {
      this.applyZoom(Math.max(this.zoom - 0.25, 0.5));
    },

    applyZoom(zoom) {
      if(zoom === this.zoom || this.type !== 'pdf') return;
      this.zoom = zoom;
      const rendered = document.createElement('div');
      const rendering = this.renderFit(rendered);
      this.$dispatch('file-zoom', this.file, this.zoom);

      // Render off-screen and swap atomically. This keeps the current page
      // visible while zooming and lets us restore the latest reading position.
      rendering.then(() => {
        if(this.zoom !== zoom || this.type !== 'pdf') return;
        const ratio = this.fileScrollRatio();
        this.replacePDF(rendered, ratio);
      });
    },

    /**
     * Live zoom preview (slider drag / pinch): cheap CSS scale first,
     * then a real re-render once the gesture settles.
     * Snaps onto 100% when close; clamped to 50% - 300%.
     */
    setZoomPreview(z) {
      let zoom = Math.min(Math.max(z, 0.5), 3);
      if(Math.abs(zoom - 1) < 0.07) zoom = 1; // magnet around default

      this._previewZoom = zoom;
      const el = this.$els.pages;
      el.style.transformOrigin = 'top center';
      el.style.transform = zoom === this.zoom ? '' : `scale(${zoom / this.zoom})`;

      if(this._zoomCommit) clearTimeout(this._zoomCommit);
      this._zoomCommit = setTimeout(() => this.commitZoom(), 280);
    },

    commitZoom() {
      const zoom = this._previewZoom;
      if(zoom === null || zoom === undefined) return;
      this._previewZoom = null;
      this.$els.pages.style.transform = '';
      this.applyZoom(zoom);
    },

    onSlider(e) {
      this.setZoomPreview(parseInt(e.target.value, 10) / 100);
    },

    wheel(e) {
      // Trackpad pinches arrive as ctrl+wheel
      if(!e.ctrlKey || this.type !== 'pdf') return;
      e.preventDefault();

      const base = this._previewZoom !== null && this._previewZoom !== undefined
        ? this._previewZoom : this.zoom;
      this.setZoomPreview(base * (1 - (e.deltaY * 0.01)));
    },

    projectionState() {
      // Commit any in-progress slider/pinch preview before taking the cast
      // snapshot. The visible reading position is captured synchronously, so
      // an immediate Cast click cannot lose the latest scroll event.
      if(this._previewZoom !== null && this._previewZoom !== undefined)
        this.commitZoom();
      return {
        zoom: this.zoom,
        scrollRatio: this.fileScrollRatio(),
      };
    },

    project() {
      this.$dispatch('project-file', this.file, false, this.projectionState());
    },

    save() {
      dialog.showSaveDialog({
        title: this.t('saveFile'),
        defaultPath: this.file.name,
      }).then(({ canceled, filePath }) => {
        if(canceled || !filePath) return;
        const buf = Buffer.from(new Uint8Array(this.fileCont));

        fs.writeFile(filePath, buf, (err) => {
          if(err) dialog.showErrorBox(this.t('saveFailed'), err.stack);
          else dialog.showMessageBox({
            type: 'info',
            buttons: [this.t('openFile'), this.t('ok')],
            defaultId: 1,
            cancelId: 1,
            message: this.t('saveSuccess'),
            detail: `${this.t('savedTo')}${filePath}`,
          }).then(({ response }) => {
            if(response === 0)
              shell.openPath(filePath);
          });
        });
      });
    },


    drop(e) {
      if(!this.authorized) return;
      const dt = e.dataTransfer;
      if(dt.files.length !== 1) {
        alert(this.t('oneFileOnly'));
        return;
      }

      const type = dt.files[0].type;
      if(type !== this.file.type) {
        alert(`${this.t('sameTypeOnly')}${type}`);
        return;
      }

      fs.readFile(dt.files[0].path, (err, data) => {
        this.$dispatch('edit-file', this.file.id, data);
      });
    },

    scroll() {
      if(this._scrollThrottle) return;
      this._scrollThrottle = setTimeout(() => {
        this._scrollThrottle = null;
        this.$dispatch('file-scroll', this.file, this.fileScrollRatio());
      }, 80);
    },
  },

  computed: {
    shortName() {
      return this.file.name.split('.')[0];
    },

    imgRendered() {
      const blob = new Blob([this.fileCont], { type: this.file.type });
      return URL.createObjectURL(blob);
    },
  },
});

module.exports = FileView;
