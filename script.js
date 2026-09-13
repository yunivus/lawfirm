
document.addEventListener("DOMContentLoaded",()=>{
  const toast=(msg)=>{
    let t=document.querySelector(".toast");
    if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
    t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);
    window.__toast=setTimeout(()=>t.classList.remove("show"),2200);
  };
  document.querySelectorAll("[data-toast]").forEach(el=>el.addEventListener("click",e=>{
    e.preventDefault();toast(el.dataset.toast);
  }));
  document.querySelectorAll(".sidebar .side-link").forEach(a=>a.addEventListener("click",()=>{
    document.querySelector(".sidebar")?.classList.remove("open");
  }));
  document.querySelector(".menu-toggle")?.addEventListener("click",()=>{
    document.querySelector(".sidebar")?.classList.toggle("open");
  });
  document.querySelectorAll("form[data-demo]").forEach(form=>form.addEventListener("submit",e=>{
    e.preventDefault();toast(form.dataset.demo||"Saved successfully");
  }));
  document.querySelectorAll(".tabs a").forEach(tab=>tab.addEventListener("click",e=>{
    e.preventDefault();
    tab.parentElement.querySelectorAll("a").forEach(x=>x.classList.remove("active"));
    tab.classList.add("active");
  }));
  document.querySelectorAll("[data-filter]").forEach(input=>{
    input.addEventListener("input",()=>{
      const q=input.value.toLowerCase();
      const target=document.querySelector(input.dataset.filter);
      if(!target)return;
      target.querySelectorAll("tbody tr").forEach(row=>{
        row.style.display=row.innerText.toLowerCase().includes(q)?"":"none";
      });
    });
  });
  document.querySelectorAll("[data-route]").forEach(el=>el.addEventListener("click",()=>{
    window.location.href=el.dataset.route;
  }));
});
