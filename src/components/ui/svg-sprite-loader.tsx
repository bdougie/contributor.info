import { useEffect, useState } from 'react';

/**
 * SVG Sprite Loader - loads and inlines the SVG sprite for cross-browser compatibility
 * External SVG references don't work reliably in all browsers, so we inline the sprite
 */

let spritePromise: Promise<string> | null = null;
let spriteContent: string | null = null;

async function loadSpriteContent(): Promise<string> {
  if (spriteContent) {
    return spriteContent;
  }

  if (!spritePromise) {
    spritePromise = fetch('/icons.svg')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load SVG sprite: ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        spriteContent = text;
        return text;
      })
      .catch((error) => {
        console.error("Error:", error);
        spritePromise = null;
        return '';
      });
  }

  return spritePromise;
}

export function useSVGSprite(): boolean {
  const [isLoaded, setIsLoaded] = useState(spriteContent !== null);

  useEffect(() => {
    if (spriteContent) {
      return;
    }

    loadSpriteContent().then(() => {
      setIsLoaded(true);
    });
  }, []);

  return isLoaded;
}

export function SVGSpriteInliner() {
  const [spriteHTML, setSpriteHTML] = useState<string>('');

  useEffect(() => {
    loadSpriteContent().then((content) => {
      if (content) {
        // Extract just the defs/symbols part from the sprite
        const match = content.match(/<svg[^>]*>(.*?)<\/svg>/s);
        if (match) {
          setSpriteHTML(match[1]);
        }
      }
    });
  }, []);

  if (!spriteHTML) {
    return null;
  }

  // Inline the sprite at the top of the page
  return (
    <svg
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        visibility: 'hidden',
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: spriteHTML }}
    />
  );
}
