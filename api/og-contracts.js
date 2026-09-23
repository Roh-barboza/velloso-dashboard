import { ImageResponse } from '@vercel/og';
import { jsx, jsxs } from 'react/jsx-runtime';

const box=(style,children)=>jsx('div',{style,children});

export default function handler() {
  const wine='#6d0f27', gold='#9b7844';
  const globe=jsxs('svg',{
    width:'78',height:'78',viewBox:'0 0 100 100',
    children:[
      jsx('circle',{cx:'50',cy:'50',r:'40',fill:'none',stroke:wine,strokeWidth:'3'}),
      jsx('path',{d:'M23 42 C31 33 37 39 43 34 C47 30 43 24 51 22 C59 20 64 28 61 34 C58 41 66 43 72 47 C79 52 72 59 66 60 C58 61 59 72 52 76 C46 80 42 72 37 69 C30 65 24 70 20 62',fill:'none',stroke:wine,strokeWidth:'3',strokeLinecap:'round'})
    ]
  });
  const icon=(symbol,label)=>box({display:'flex',flexDirection:'column',alignItems:'center',width:'170px'},[
    box({width:'52px',height:'52px',border:'3px solid '+gold,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px',color:gold},symbol),
    box({fontSize:'18px',marginTop:'10px',textAlign:'center',display:'flex'},label)
  ]);
  return new ImageResponse(
    box({
      width:'1200px',height:'630px',display:'flex',position:'relative',overflow:'hidden',
      background:'linear-gradient(135deg,#faf5ed 0%,#ecdfce 100%)',
      color:'#171817',fontFamily:'Georgia, Times New Roman, serif'
    },[
      box({position:'absolute',inset:'22px',border:'2px solid rgba(155,120,68,.34)',borderRadius:'26px',display:'flex'},''),
      box({position:'absolute',right:'-25px',top:'-48px',width:'355px',height:'148px',background:'linear-gradient(90deg,#177047 0 33%,#f6f0e8 33% 66%,#a72d34 66%)',transform:'rotate(23deg)',borderRadius:'18px',display:'flex'},''),
      box({position:'absolute',right:'-4px',bottom:'-28px',width:'380px',height:'315px',background:'linear-gradient(145deg,rgba(124,91,50,.03),rgba(124,91,50,.16))',borderRadius:'55% 0 0 0',display:'flex'},''),
      box({position:'absolute',right:'50px',bottom:'42px',width:'300px',height:'230px',background:'#fffaf1',border:'2px solid rgba(143,106,59,.42)',transform:'rotate(-7deg)',boxShadow:'0 18px 40px rgba(60,44,27,.18)',padding:'28px',display:'flex',flexDirection:'column'},[
        box({fontSize:'28px',letterSpacing:'8px',color:'#4a3c2c',display:'flex'},'CONTRATO'),
        box({width:'125px',height:'3px',background:gold,marginTop:'17px',display:'flex'},''),
        box({width:'200px',height:'2px',background:'#d5c8b3',marginTop:'20px',display:'flex'},''),
        box({width:'180px',height:'2px',background:'#d5c8b3',marginTop:'15px',display:'flex'},''),
        box({width:'205px',height:'2px',background:'#d5c8b3',marginTop:'15px',display:'flex'},''),
        box({width:'160px',height:'2px',background:'#d5c8b3',marginTop:'15px',display:'flex'},'')
      ]),
      box({position:'absolute',right:'32px',bottom:'82px',width:'265px',height:'25px',background:'#171714',borderRadius:'13px',transform:'rotate(-18deg)',boxShadow:'0 8px 18px rgba(0,0,0,.24)',display:'flex'},''),
      box({position:'absolute',right:'263px',bottom:'126px',width:'52px',height:'25px',background:'#b08a50',borderRadius:'10px',transform:'rotate(-18deg)',display:'flex'},''),

      box({width:'800px',height:'630px',padding:'48px 62px',display:'flex',flexDirection:'column'},[
        box({display:'flex',alignItems:'center',gap:'16px'},[
          globe,
          box({display:'flex',flexDirection:'column'},[
            box({fontSize:'54px',fontWeight:700,letterSpacing:'5px',color:wine,display:'flex'},'VELLOSO'),
            box({fontFamily:'Arial, sans-serif',fontSize:'15px',letterSpacing:'14px',color:wine,marginLeft:'5px',display:'flex'},'CIDADANIA')
          ])
        ]),
        box({marginTop:'55px',fontSize:'59px',lineHeight:'1.02',fontWeight:700,display:'flex'},'Formulário de Contratos'),
        box({marginTop:'16px',fontSize:'24px',lineHeight:'1.36',fontFamily:'Arial, sans-serif',color:'#343530',display:'flex',maxWidth:'640px'},'Preencha seus dados para elaboração do contrato com a nossa equipe.'),
        box({display:'flex',gap:'24px',marginTop:'58px',fontFamily:'Arial, sans-serif'},[
          icon('✓','Segurança'),
          icon('◷','Agilidade'),
          icon('♧','Atendimento especializado')
        ])
      ])
    ]),
    { width:1200, height:630 }
  );
}
