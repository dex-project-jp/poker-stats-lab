(function(root){
  function endpoint(value){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(value)){
      throw Error('Apps Scriptの /exec で終わるURLを入力してください');
    }
    return value;
  }
  async function send(connection,records){
    if(!records.length)return {added:0,existing:0};
    const url=endpoint(connection.url);
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
    return new Promise((resolve,reject)=>{
      const frame=document.createElement('iframe');
      frame.name='sheets-'+nonce;
      frame.hidden=true;
      const form=document.createElement('form');
      form.hidden=true;
      form.action=url;
      form.method='POST';
      form.target=frame.name;
      const input=document.createElement('input');
      input.type='hidden';
      input.name='payload';
      input.value=JSON.stringify({nonce,token:connection.token,records:records.map(({id,date,venue,event,players,rank,previous})=>({id,date,venue,event,players,rank,previous}))});
      form.append(input);
      function finish(error,result){
        clearTimeout(timer);
        window.removeEventListener('message',receive);
        frame.remove();
        form.remove();
        if(error)reject(Error(error));
        else resolve(result);
      }
      function receive(event){
        if(!/^https:\/\/(?:script\.google\.com|[\w-]+-script\.googleusercontent\.com|script\.googleusercontent\.com)$/.test(event.origin))return;
        const result=event.data;
        if(!result||result.nonce!==nonce)return;
        if(!result.ok){finish(result.code==='auth'?'接続キーを確認してください':'シートへの書き込みエラー');return;}
        if(!Number.isSafeInteger(result.added)||result.added<0||!Number.isSafeInteger(result.existing)||result.existing<0||result.added+result.existing!==records.length)return;
        finish(null,result);
      }
      const timer=setTimeout(()=>finish('通信エラー'),25000);
      window.addEventListener('message',receive);
      document.body.append(frame,form);
      try{form.submit();}catch{finish('通信エラー');}
    });
  }
  root.StatsSync={endpoint,send};
})(window);
