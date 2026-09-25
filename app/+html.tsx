import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  const earlyTheme = `(function(){try{var k='guerrilla_theme_v1';var keys=[k,'@'+k];var t=null;for(var i=0;i<keys.length;i++){var raw=localStorage.getItem(keys[i]);if(!raw)continue;if(raw==='guerrilla'||raw==='classic'||raw==='oscuro'){t=raw;break;}try{var p=JSON.parse(raw);if(p==='guerrilla'||p==='classic'||p==='oscuro'){t=p;break;}}catch(e){}}if(!t)t='guerrilla';var bg={guerrilla:'#14081F',classic:'#F2F2F2',oscuro:'#0B0B0E'};var color=bg[t]||bg.guerrilla;var el=document.documentElement;el.dataset.theme=t;el.style.backgroundColor=color;if(document.body)document.body.style.backgroundColor=color;var s=document.createElement('style');s.id='gc-early-theme';s.appendChild(document.createTextNode('html,body,#root{background-color:'+color+'!important}'));document.head.appendChild(s);}catch(e){}})();`;

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
