import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div style={{
        width:'1200px',height:'630px',display:'flex',position:'relative',overflow:'hidden',
        background:'linear-gradient(135deg,#f8f3eb 0%,#eee3d4 100%)',
        color:'#151716',fontFamily:'Georgia, Times New Roman, serif'
      }}>
        <div style={{position:'absolute',inset:'22px',border:'2px solid rgba(169,132,76,.38)',borderRadius:'28px',display:'flex'}} />
        <div style={{position:'absolute',right:'0',top:'0',width:'350px',height:'630px',
          background:'linear-gradient(135deg,rgba(50,35,24,.10),rgba(25,18,14,.25))',display:'flex'}} />
        <div style={{position:'absolute',right:'-36px',top:'-45px',width:'330px',height:'150px',
          background:'linear-gradient(90deg,#177047 0 33%,#f4efe5 33% 66%,#a02c2c 66%)',
          transform:'rotate(24deg)',borderRadius:'18px',opacity:.95,display:'flex'}} />
        <div style={{position:'absolute',right:'72px',bottom:'58px',width:'285px',height:'250px',
          background:'#fffaf0',border:'2px solid rgba(150,112,60,.45)',transform:'rotate(-6deg)',
          boxShadow:'0 20px 45px rgba(64,44,24,.18)',padding:'28px',display:'flex',flexDirection:'column'}}>
          <div style={{fontSize:27,letterSpacing:'8px',color:'#54412d',display:'flex'}}>CONTRATO</div>
          <div style={{width:'120px',height:'3px',background:'#a07a42',marginTop:'18px',display:'flex'}} />
          <div style={{width:'185px',height:'2px',background:'#d7c8b0',marginTop:'21px',display:'flex'}} />
          <div style={{width:'170px',height:'2px',background:'#d7c8b0',marginTop:'16px',display:'flex'}} />
          <div style={{width:'192px',height:'2px',background:'#d7c8b0',marginTop:'16px',display:'flex'}} />
          <div style={{width:'150px',height:'2px',background:'#d7c8b0',marginTop:'16px',display:'flex'}} />
        </div>
        <div style={{position:'absolute',right:'44px',bottom:'98px',width:'260px',height:'28px',
          background:'#171815',borderRadius:'16px',transform:'rotate(-18deg)',boxShadow:'0 8px 18px rgba(0,0,0,.25)',display:'flex'}} />
        <div style={{position:'absolute',right:'278px',bottom:'144px',width:'55px',height:'28px',
          background:'#b49358',borderRadius:'14px',transform:'rotate(-18deg)',display:'flex'}} />

        <div style={{width:'780px',height:'630px',padding:'54px 64px',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:'18px'}}>
            <svg width="78" height="78" viewBox="0 0 100 100" style={{display:'flex'}}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#6d0f27" strokeWidth="3"/>
              <path d="M23 42 C31 33 37 39 43 34 C47 30 43 24 51 22 C59 20 64 28 61 34 C58 41 66 43 72 47 C79 52 72 59 66 60 C58 61 59 72 52 76 C46 80 42 72 37 69 C30 65 24 70 20 62" fill="none" stroke="#6d0f27" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div style={{display:'flex',flexDirection:'column'}}>
              <div style={{fontSize:'54px',fontWeight:700,letterSpacing:'5px',color:'#6d0f27',display:'flex'}}>VELLOSO</div>
              <div style={{fontSize:'16px',letterSpacing:'14px',color:'#6d0f27',marginLeft:'5px',display:'flex'}}>CIDADANIA</div>
            </div>
          </div>

          <div style={{marginTop:'58px',fontSize:'58px',lineHeight:1.04,fontWeight:700,display:'flex'}}>Formulário de Contratos</div>
          <div style={{marginTop:'18px',fontSize:'25px',lineHeight:1.35,fontFamily:'Arial, sans-serif',color:'#363633',display:'flex',maxWidth:'620px'}}>
            Preencha seus dados para elaboração do contrato com a nossa equipe.
          </div>

          <div style={{display:'flex',gap:'42px',marginTop:'62px',fontFamily:'Arial, sans-serif'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'145px'}}>
              <div style={{width:'52px',height:'52px',border:'3px solid #a57b42',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',color:'#a57b42'}}>✓</div>
              <div style={{fontSize:'18px',marginTop:'12px',display:'flex'}}>Segurança</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'145px'}}>
              <div style={{width:'52px',height:'52px',border:'3px solid #a57b42',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'25px',color:'#a57b42'}}>◷</div>
              <div style={{fontSize:'18px',marginTop:'12px',display:'flex'}}>Agilidade</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'190px'}}>
              <div style={{fontSize:'42px',color:'#a57b42',display:'flex'}}>♧</div>
              <div style={{fontSize:'18px',marginTop:'4px',textAlign:'center',display:'flex'}}>Atendimento especializado</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
