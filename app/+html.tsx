import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Web document shell. Inline script + boot overlay apply the saved skin
 * before React paints the welcome card (no default→saved flash).
 */
export default function Root({ children }: PropsWithChildren) {
  const earlyTheme = `(function(){try{var k='guerrilla_theme_v1';var keys=[k,'@'+k];var t=null;for(var i=0;i<keys.length;i++){var raw=localStorage.getItem(keys[i]);if(!raw)continue;if(raw==='guerrilla'||raw==='classic'||raw==='oscuro'){t=raw;break;}try{var p=JSON.parse(raw);if(p==='guerrilla'||p==='classic'||p==='oscuro'){t=p;break;}}catch(e){}}var bg={guerrilla:'#14081F',classic:'#F2F2F2',oscuro:'#0B0B0E'};var color=t&&bg[t]?bg[t]:'#14081F';window.__GC_THEME=t||'guerrilla';window.__GC_THEME_BG=color;var el=document.documentElement;el.dataset.theme=window.__GC_THEME;el.style.backgroundColor=color;var css='html,body{background-color:'+color+'!important}#gc-boot{position:fixed;inset:0;z-index:2147483647;background:'+color+';pointer-events:none}';var s=document.createElement('style');s.id='gc-early-theme';s.appendChild(document.createTextNode(css));document.head.appendChild(s);}catch(e){}})();`;

  const bootScript = `(function(){try{var b=document.getElementById('gc-boot');if(!b){b=document.createElement('div');b.id='gc-boot';document.body.insertBefore(b,document.body.firstChild);}b.style.background=window.__GC_THEME_BG||'#14081F';}catch(e){}})();`;

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
      <body>
        <div id="gc-boot" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {children}
      </body>
    </html>
  );
}
