import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Web document shell. Inline script applies saved skin before React hydrates
 * so home/lobby don't flash the default theme.
 */
export default function Root({ children }: PropsWithChildren) {
  const earlyTheme = `(function(){try{var k='guerrilla_theme_v1';var t=localStorage.getItem(k);if(!t){var a=localStorage.getItem('@'+k);if(a){try{var p=JSON.parse(a);t=typeof p==='string'?p:a;}catch(e){t=a;}}}var bg={guerrilla:'#14081F',classic:'#F2F2F2',oscuro:'#0B0B0E'};if(t&&bg[t]){document.documentElement.dataset.theme=t;document.documentElement.style.backgroundColor=bg[t];var css='html,body{background-color:'+bg[t]+'!important}';var s=document.createElement('style');s.id='gc-early-theme';s.appendChild(document.createTextNode(css));document.head.appendChild(s);}}catch(e){}})();`;

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: earlyTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
