const configElement = document.getElementById("pageConfig");

if (configElement) {
  const config = JSON.parse(configElement.textContent);

  const form = document.getElementById("promptForm");
  const generatedPrompt = document.getElementById("generatedPrompt");
  const copyButton = document.getElementById("copyButton");
  const statusMessage = document.getElementById("statusMessage");
  const pageEyebrow = document.getElementById("pageEyebrow");
  const pageTitle = document.getElementById("pageTitle");
  const pageCopy = document.getElementById("pageCopy");
  const formTitle = document.getElementById("formTitle");
  const formDescription = document.getElementById("formDescription");

  function setPageMeta() {
    document.title = `${config.pageTitle} | 自動プロンプト作成ツール`;
    pageEyebrow.textContent = config.eyebrow;
    pageTitle.innerHTML = config.pageHeadingHtml || config.pageTitle;
    pageCopy.textContent = config.heroCopy;
    formTitle.textContent = config.formTitle;
    formDescription.textContent = config.formDescription;
  }

  function renderTextarea(field) {
    return `
      <label class="field" data-field-id="${field.id}"${renderConditionalAttributes(field)}>
        <span>${field.label}</span>
        <textarea
          id="${field.id}"
          name="${field.id}"
          rows="${field.rows || 3}"
          ${field.required ? "required" : ""}
          placeholder="${field.placeholder || ""}"
        ></textarea>
      </label>
    `;
  }

  function renderSelect(field) {
    const options = field.options
      .map((option) => {
        const selected = field.default === option ? "selected" : "";
        return `<option value="${option}" ${selected}>${option}</option>`;
      })
      .join("");

    return `
      <label class="field" data-field-id="${field.id}"${renderConditionalAttributes(field)}>
        <span>${field.label}</span>
        <select id="${field.id}" name="${field.id}" ${field.required ? "required" : ""}>
          ${options}
        </select>
      </label>
    `;
  }

  function renderRadio(field) {
    const options = field.options
      .map((option, index) => {
        const checked =
          field.default ? field.default === option : index === 0;

        return `
          <label class="choice-pill">
            <input
              type="radio"
              name="${field.id}"
              value="${option}"
              ${checked ? "checked" : ""}
            />
            <span>${option}</span>
          </label>
        `;
      })
      .join("");

    return `
      <fieldset class="field" data-field-id="${field.id}"${renderConditionalAttributes(field)}>
        <legend>${field.label}</legend>
        <div class="choice-row">${options}</div>
      </fieldset>
    `;
  }

  function renderConditionalAttributes(field) {
    if (!field.conditional) {
      return "";
    }

    return ` data-conditional-field="${field.conditional.field}" data-conditional-value="${field.conditional.value}"`;
  }

  function renderFields() {
    const fieldsMarkup = config.fields
      .map((field) => {
        if (field.type === "radio") {
          return renderRadio(field);
        }

        if (field.type === "select") {
          return renderSelect(field);
        }

        return renderTextarea(field);
      })
      .join("");

    form.innerHTML = `
      ${fieldsMarkup}
      <div class="actions">
        <button type="submit" class="button primary">プロンプトを生成</button>
        <button type="button" id="fillExample" class="button secondary">例を入力</button>
        <button type="reset" class="button ghost">リセット</button>
      </div>
    `;
  }

  function getFieldValue(fieldId) {
    const field = config.fields.find((item) => item.id === fieldId);

    if (!field) {
      return "";
    }

    if (field.type === "radio") {
      return new FormData(form).get(fieldId) || "";
    }

    const element = document.getElementById(fieldId);
    return element ? element.value.trim() : "";
  }

  function getFormData() {
    const data = {};

    config.fields.forEach((field) => {
      data[field.id] = getFieldValue(field.id);
    });

    return data;
  }

  function conditionMatches(condition, data) {
    if (!condition) {
      return true;
    }

    return data[condition.field] === condition.value;
  }

  function buildPrompt(data) {
    const sections = [config.intro, "", config.guidance];

    config.promptSections.forEach((section) => {
      if (!conditionMatches(section.conditional, data)) {
        return;
      }

      const rawValue = section.field ? data[section.field] : section.text || "";
      const value = rawValue || section.emptyFallback || "";

      if (!value) {
        return;
      }

      sections.push("", section.title, value);
    });

    if (config.expectation) {
      sections.push("", "＃期待する進め方", config.expectation);
    }

    return sections.join("\n");
  }

  function saveToLocalStorage() {
    localStorage.setItem(config.storageKey, JSON.stringify(getFormData()));
  }

  function applyConditionalVisibility() {
    const data = getFormData();
    const conditionalElements = form.querySelectorAll("[data-conditional-field]");

    conditionalElements.forEach((element) => {
      const field = element.dataset.conditionalField;
      const value = element.dataset.conditionalValue;
      const show = data[field] === value;

      element.classList.toggle("is-hidden", !show);
      element.setAttribute("aria-hidden", String(!show));
    });
  }

  function hasMeaningfulInput(data) {
    return config.fields.some((field) => {
      const value = data[field.id];
      return Boolean(value && value.trim());
    });
  }

  function restoreSavedData() {
    const raw = localStorage.getItem(config.storageKey);

    if (!raw) {
      applyConditionalVisibility();
      return;
    }

    try {
      const data = JSON.parse(raw);

      config.fields.forEach((field) => {
        if (!(field.id in data)) {
          return;
        }

        if (field.type === "radio") {
          const radio = form.querySelector(
            `input[name="${field.id}"][value="${data[field.id]}"]`
          );

          if (radio) {
            radio.checked = true;
          }

          return;
        }

        const element = document.getElementById(field.id);
        if (element && typeof data[field.id] === "string") {
          element.value = data[field.id];
        }
      });

      applyConditionalVisibility();

      if (hasMeaningfulInput(data)) {
        generatedPrompt.value = buildPrompt(getFormData());
        statusMessage.textContent = "復元済み";
      }
    } catch {
      localStorage.removeItem(config.storageKey);
      applyConditionalVisibility();
    }
  }

  function fillExample() {
    const entries = Object.entries(config.exampleData || {});

    entries.forEach(([fieldId, value]) => {
      const field = config.fields.find((item) => item.id === fieldId);

      if (!field) {
        return;
      }

      if (field.type === "radio") {
        const radio = form.querySelector(
          `input[name="${fieldId}"][value="${value}"]`
        );

        if (radio) {
          radio.checked = true;
        }

        return;
      }

      const element = document.getElementById(fieldId);
      if (element) {
        element.value = value;
      }
    });

    applyConditionalVisibility();
    generatedPrompt.value = buildPrompt(getFormData());
    statusMessage.textContent = "例を入力しました";
    saveToLocalStorage();
  }

  function handleReset() {
    window.setTimeout(() => {
      config.fields.forEach((field) => {
        if (field.type !== "radio" || !field.default) {
          return;
        }

        const radio = form.querySelector(
          `input[name="${field.id}"][value="${field.default}"]`
        );

        if (radio) {
          radio.checked = true;
        }
      });

      config.fields.forEach((field) => {
        if (field.type === "select" && field.default) {
          const element = document.getElementById(field.id);
          if (element) {
            element.value = field.default;
          }
        }
      });

      applyConditionalVisibility();
      generatedPrompt.value = "";
      statusMessage.textContent = "リセットしました";
      localStorage.removeItem(config.storageKey);
    }, 0);
  }

  function handleCopy() {
    const text = generatedPrompt.value.trim();

    if (!text) {
      statusMessage.textContent = "先にプロンプトを生成してください";
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        statusMessage.textContent = "コピーしました";
      })
      .catch(() => {
        generatedPrompt.focus();
        generatedPrompt.select();
        statusMessage.textContent = "選択状態にしました";
      });
  }

  function bindEvents() {
    form.addEventListener("change", () => {
      applyConditionalVisibility();
      saveToLocalStorage();
    });

    form.addEventListener("input", () => {
      saveToLocalStorage();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      generatedPrompt.value = buildPrompt(getFormData());
      statusMessage.textContent = "プロンプトを生成しました";
      saveToLocalStorage();
    });

    form.addEventListener("reset", handleReset);

    copyButton.addEventListener("click", handleCopy);

    const fillExampleButton = document.getElementById("fillExample");
    fillExampleButton.addEventListener("click", fillExample);
  }

  setPageMeta();
  renderFields();
  restoreSavedData();
  bindEvents();
}
