import { useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translateStaticText } from '@/lib/i18n';

const originalTextNodes = new WeakMap<Text, string>();
const translatedAttributes = ['placeholder', 'aria-label', 'title'] as const;

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest('script, style, svg, code, pre, [data-i18n-skip="true"]'));
}

function translateTextNode(node: Text, language: 'id' | 'en') {
  if (shouldSkipNode(node)) return;
  const current = node.nodeValue ?? '';
  const original = originalTextNodes.get(node) ?? current;

  if (language === 'id') {
    if (originalTextNodes.has(node) && node.nodeValue !== original) node.nodeValue = original;
    return;
  }

  const translated = translateStaticText(original, language);
  if (translated !== original) {
    if (!originalTextNodes.has(node)) {
      originalTextNodes.set(node, original);
    }
    if (node.nodeValue !== translated) {
      node.nodeValue = translated;
    }
  }
}

function translateElementAttributes(element: Element, language: 'id' | 'en') {
  translatedAttributes.forEach((attribute) => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    const storageName = `data-i18n-original-${attribute}`;
    const original = element.getAttribute(storageName) ?? value;

    if (language === 'id') {
      if (element.hasAttribute(storageName)) {
        element.setAttribute(attribute, original);
      }
      return;
    }

    const translated = translateStaticText(original, language);
    if (translated !== original) {
      if (!element.hasAttribute(storageName)) {
        element.setAttribute(storageName, original);
      }
      if (element.getAttribute(attribute) !== translated) {
        element.setAttribute(attribute, translated);
      }
    }
  });
}

function translateTree(root: ParentNode, language: 'id' | 'en') {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node as Text, language);
    node = walker.nextNode();
  }

  if (root instanceof Element) {
    translateElementAttributes(root, language);
  }
  root.querySelectorAll?.('*').forEach((element) => translateElementAttributes(element, language));
}

export default function AppTextTranslator() {
  const { language } = useLanguage();

  useEffect(() => {
    const processNodes = (nodes: Node[]) => {
      const processedElements: Element[] = [];

      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          translateTextNode(node as Text, language);
          return;
        }

        if (!(node instanceof Element)) return;
        if (processedElements.some((element) => element.contains(node))) return;

        processedElements.push(node);
        translateTree(node, language);
      });
    };

    translateTree(document.body, language);

    let queuedNodes: Node[] = [];
    let frameId: number | null = null;

    const flushQueue = () => {
      frameId = null;
      const nodes = queuedNodes;
      queuedNodes = [];
      processNodes(nodes);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => queuedNodes.push(node));
      });

      if (queuedNodes.length > 0 && frameId === null) {
        frameId = window.requestAnimationFrame(flushQueue);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [language]);

  return null;
}
