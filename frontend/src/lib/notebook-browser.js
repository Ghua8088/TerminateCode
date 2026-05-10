// http://github.com/jsvine/notebookjs
// notebook.js may be freely distributed under the MIT license.
// Browser-only version of notebookjs (Node/JSDOM dependencies removed)
const VERSION = "0.8.3";
const root = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
const doc = root.document;

// Helper functions
const ident = (x) => x;

const makeElement = (tag, classNames) => {
    if (!doc) return { tagName: tag, className: '', appendChild: () => {}, setAttribute: () => {}, innerHTML: '' };
    const el = doc.createElement(tag);
    el.className = (classNames || []).map((cn) => "nb-" + cn).join(" ");
    return el;
};

const escapeHTML = (raw) => {
    return raw.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const joinText = (text) => {
    if (Array.isArray(text)) {
        return text.map(joinText).join("");
    } else {
        return text;
    }
};

const nb = {
    prefix: "nb-",
    markdown: ident,
    ansi: ident,
    sanitizer: ident,
    executeJavaScript: false,
    highlighter: ident,
    VERSION: VERSION
};

nb.Input = function (raw, cell) {
    this.raw = raw;
    this.cell = cell;
};

nb.Input.prototype.render = function () {
    if (!this.raw || !this.raw.length) { return makeElement("div"); }
    const holder = makeElement("div", [ "input" ]);
    const cell = this.cell;
    if (typeof cell.number === "number") {
        holder.setAttribute("data-prompt-number", cell.number);
    }
    const pre_el = makeElement("pre");
    const code_el = makeElement("code");
    const meta = (cell.worksheet && cell.worksheet.notebook && cell.worksheet.notebook.metadata) || {};
    const lang = cell.raw.language || meta.language || (meta.kernelspec && meta.kernelspec.language) || (meta.language_info && meta.language_info.name) || "python";
    code_el.setAttribute("data-language", lang);
    code_el.className = "lang-" + lang;
    code_el.innerHTML = nb.highlighter(escapeHTML(joinText(this.raw)), pre_el, code_el, lang);
    pre_el.appendChild(code_el);
    holder.appendChild(pre_el);
    this.el = holder;
    return holder;
};

const imageCreator = (format) => {
    return (data) => {
        const el = makeElement("img", [ "image-output" ]);
        el.src = "data:image/" + format + ";base64," + joinText(data).replace(/\n/g, "");
        return el;
    };
};

nb.display = {};
nb.display.text = (text) => {
    const el = makeElement("pre", [ "text-output" ]);
    el.innerHTML = nb.highlighter(nb.ansi(escapeHTML(joinText(text))), el);
    return el;
};
nb.display["text/plain"] = nb.display.text;

nb.display.html = (html) => {
    const el = makeElement("div", [ "html-output" ]);
    el.innerHTML = nb.sanitizer(joinText(html));
    return el;
};
nb.display["text/html"] = nb.display.html;

nb.display.marked = (md) => {
    return nb.display.html(nb.markdown(joinText(md)));
};
nb.display["text/markdown"] = nb.display.marked;

nb.display.png = imageCreator("png");
nb.display["image/png"] = nb.display.png;
nb.display.jpeg = imageCreator("jpeg");
nb.display["image/jpeg"] = nb.display.jpeg;

nb.display_priority = [
    "png", "image/png", "jpeg", "image/jpeg",
    "svg", "image/svg+xml", "text/svg+xml", "html", "text/html",
    "text/markdown", "latex", "text/latex",
    "javascript", "application/javascript",
    "text", "text/plain"
];

const render_display_data = function () {
    const o = this;
    const formats = nb.display_priority.filter((d) => {
        return o.raw.data ? o.raw.data[d] : o.raw[d];
    });
    const format = formats[0];
    if (format) {
        if (nb.display[format]) {
            return nb.display[format](o.raw[format] || o.raw.data[format]);
        }
    }
    return makeElement("div", [ "empty-output" ]);
};

const render_error = function () {
    const el = makeElement("pre", [ "pyerr" ]);
    const raw = (this.raw.traceback || []).join("\n");
    el.innerHTML = nb.highlighter(nb.ansi(escapeHTML(raw)), el);
    return el;
};

nb.Output = function (raw, cell) {
    this.raw = raw;
    this.cell = cell;
    this.type = raw.output_type;
};

nb.Output.prototype.renderers = {
    "display_data": render_display_data,
    "execute_result": render_display_data,
    "pyout": render_display_data,
    "pyerr": render_error,
    "error": render_error,
    "stream": function () {
        const el = makeElement("pre", [ (this.raw.stream || this.raw.name) ]);
        const raw = joinText(this.raw.text);
        el.innerHTML = nb.highlighter(nb.ansi(escapeHTML(raw)), el);
        return el;
    }
};

nb.Output.prototype.render = function () {
    const outer = makeElement("div", [ "output" ]);
    if (typeof this.cell.number === "number") {
        outer.setAttribute("data-prompt-number", this.cell.number);
    }
    const inner = (this.renderers[this.type] || (() => makeElement("div"))).call(this);
    outer.appendChild(inner);
    this.el = outer;
    return outer;
};

nb.coalesceStreams = (outputs) => {
    if (!outputs.length) { return outputs; }
    let last = outputs[0];
    const new_outputs = [ last ];
    outputs.slice(1).forEach((o) => {
        if (o.raw.output_type === "stream" &&
            last.raw.output_type === "stream" &&
            o.raw.stream === last.raw.stream &&
            o.raw.name === last.raw.name) {
            last.raw.text = last.raw.text.concat(o.raw.text);
        } else {
            new_outputs.push(o);
            last = o;
        }
    });
    return new_outputs;
};

nb.Cell = function (raw, worksheet) {
    const cell = this;
    cell.raw = raw;
    cell.worksheet = worksheet;
    cell.type = raw.cell_type;
    if (cell.type === "code") {
        cell.number = raw.prompt_number > -1 ? raw.prompt_number : raw.execution_count;
        const source = raw.input || raw.source || [];
        cell.input = new nb.Input(source, cell);
        const raw_outputs = (cell.raw.outputs || []).map((o) => new nb.Output(o, cell));
        cell.outputs = nb.coalesceStreams(raw_outputs);
    }
};

nb.Cell.prototype.renderers = {
    markdown: function () {
        const el = makeElement("div", [ "cell", "markdown-cell" ]);
        const joined = joinText(this.raw.source);
        el.innerHTML = nb.sanitizer(nb.markdown(joined));
        return el;
    },
    heading: function () {
        const el = makeElement("h" + (this.raw.level || 1), [ "cell", "heading-cell" ]);
        el.innerHTML = nb.sanitizer(joinText(this.raw.source));
        return el;
    },
    raw: function () {
        const el = makeElement("div", [ "cell", "raw-cell" ]);
        el.innerHTML = escapeHTML(joinText(this.raw.source));
        return el;
    },
    code: function () {
        const cell_el = makeElement("div", [ "cell", "code-cell" ]);
        cell_el.appendChild(this.input.render());
        (this.outputs || []).forEach((o) => {
            cell_el.appendChild(o.render());
        });
        return cell_el;
    }
};

nb.Cell.prototype.render = function () {
    const el = (this.renderers[this.type] || (() => makeElement("div"))).call(this);
    this.el = el;
    return el;
};

nb.Worksheet = function (raw, notebook) {
    const worksheet = this;
    this.raw = raw;
    this.notebook = notebook;
    this.cells = (raw.cells || []).map((c) => new nb.Cell(c, worksheet));
    this.render = function () {
        const worksheet_el = makeElement("div", [ "worksheet" ]);
        this.cells.forEach((c) => {
            worksheet_el.appendChild(c.render());
        });
        this.el = worksheet_el;
        return worksheet_el;
    };
};

nb.Notebook = function (raw, config) {
    const notebook = this;
    this.raw = raw;
    this.config = config;
    const meta = this.metadata = raw.metadata || {};
    this.title = meta.title || meta.name;
    const _worksheets = raw.worksheets || [ { cells: raw.cells } ];
    this.worksheets = _worksheets.map((ws) => new nb.Worksheet(ws, notebook));
    this.sheet = this.worksheets[0];
};

nb.Notebook.prototype.render = function () {
    const notebook_el = makeElement("div", [ "notebook" ]);
    this.worksheets.forEach((w) => {
        notebook_el.appendChild(w.render());
    });
    this.el = notebook_el;
    return notebook_el;
};

nb.parse = (nbjson, config) => {
    return new nb.Notebook(nbjson, config);
};

export default nb;
