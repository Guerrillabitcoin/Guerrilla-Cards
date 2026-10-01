import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  // Runs before React: restore skin + font + stable scrollbar (no FOUC / layout jump).
  const earlyTheme = `(function(){try{var k='guerrilla_theme_v1';var keys=[k,'@'+k,'RCTAsyncLocalStorage_'+k];var t=null;try{var m=document.cookie.match(/(?:^|;\\s*)gc_theme=(guerrilla|classic|oscuro)/);if(m)t=m[1];}catch(e){}if(!t){for(var i=0;i<keys.length;i++){var raw=localStorage.getItem(keys[i]);if(!raw)continue;raw=String(raw).trim();if(raw==='guerrilla'||raw==='classic'||raw==='oscuro'){t=raw;break;}try{var p=JSON.parse(raw);if(p==='guerrilla'||p==='classic'||p==='oscuro'){t=p;break;}}catch(e){}}}if(!t)t='guerrilla';var bg={guerrilla:'#14081F',classic:'#F2F2F2',oscuro:'#0B0B0E'};var font={guerrilla:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',classic:'Verdana,Geneva,Tahoma,sans-serif',oscuro:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'};var color=bg[t]||bg.guerrilla;var ff=font[t]||font.guerrilla;var el=document.documentElement;el.dataset.theme=t;el.style.backgroundColor=color;el.style.fontFamily=ff;if(document.body){document.body.style.backgroundColor=color;document.body.style.fontFamily=ff;}var s=document.createElement('style');s.id='gc-early-theme';s.appendChild(document.createTextNode('html{scrollbar-gutter:stable;}html,body,#root{background-color:'+color+'!important;font-family:'+ff+'!important;margin:0;}'));document.head.appendChild(s);try{localStorage.setItem(k,t);document.cookie='gc_theme='+t+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}}catch(e){}})();`;

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
