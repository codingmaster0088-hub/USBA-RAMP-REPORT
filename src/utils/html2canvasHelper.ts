import html2canvas, { Options } from 'html2canvas';

/**
 * Universal safe wrapper around html2canvas to prevent Tailwind CSS v4's
 * unsupported "oklch" color parsing errors:
 * "Attempting to parse an unsupported color function 'oklch'"
 */
export const captureHtml2CanvasSafe = async (
  element: HTMLElement,
  options?: Partial<Options>
): Promise<HTMLCanvasElement> => {
  const userOnClone = options?.onclone;

  const mergedOptions: Partial<Options> = {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    ...options,
    onclone: (clonedDoc, clonedElement) => {
      try {
        // 1. Sanitize all <style> tags in cloned document
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((tag) => {
          if (tag.textContent && tag.textContent.includes('oklch')) {
            // Replace any oklch(...) pattern including slashes and commas
            tag.textContent = tag.textContent.replace(/oklch\([^)]+\)/gi, '#1e293b');
          }
        });

        // 2. Sanitize all element inline style attributes
        const styledElements = clonedDoc.querySelectorAll('*');
        styledElements.forEach((node) => {
          const el = node as HTMLElement;
          const styleAttr = el.getAttribute('style');
          if (styleAttr && styleAttr.includes('oklch')) {
            el.setAttribute('style', styleAttr.replace(/oklch\([^)]+\)/gi, '#1e293b'));
          }

          // Check direct style properties
          if (el.style) {
            for (let i = 0; i < el.style.length; i++) {
              const prop = el.style[i];
              const val = el.style.getPropertyValue(prop);
              if (val && val.includes('oklch')) {
                el.style.setProperty(prop, '#1e293b');
              }
            }
          }
        });
      } catch (err) {
        console.warn('html2canvas oklch sanitize warning:', err);
      }

      if (userOnClone) {
        userOnClone(clonedDoc, clonedElement);
      }
    }
  };

  return await html2canvas(element, mergedOptions);
};
