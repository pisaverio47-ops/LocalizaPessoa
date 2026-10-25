# 📡 Sentinel — Geolocalização em Tempo Real (Estilo Life360)

Sistema completo de rastreamento de localização familiar/dispositivos em tempo real utilizando **Leaflet**, **Supabase Realtime (WebSockets)** e pronto para deploy no **GitHub / Vercel**.

---

## 🚀 Como testar agora no seu computador e celular

O servidor de desenvolvimento já está rodando:
* **No seu computador:** Acesse [http://localhost:5173/](http://localhost:5173/)
* **No seu celular (na mesma rede Wi-Fi):** Acesse `http://192.168.0.102:5173/`

---

## 🗄️ Passo a Passo para ativar o Supabase

1. Abra o painel do seu projeto no [Supabase](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (ou "Query Editor").
3. Clique no botão **New Query**.
4. Copie todo o conteúdo do arquivo [`supabase_schema.sql`](file:///c:/Users/Pichau/Desktop/Programas/Geolocalização/supabase_schema.sql) e cole no editor.
5. Clique em **Run** (ou pressione `Ctrl + Enter`).
6. **Pronto!** As tabelas `locations`, `circles`, `places` (geofences) e `alerts` foram criadas com o Realtime ativado.

---

## 📱 Funcionalidades Implementadas

* **Transmissão GPS de Alta Precisão:** Envia latitude, longitude, velocidade real (km/h), direção e nível de bateria.
* **Mapa Tático Interativo:** Alternância com um clique entre tema Escuro (Dark Matter), Satélite e Ruas.
* **Marcadores com Pulso de Radar:** Animação contínua nos membros ativos, indicando quem está em trânsito ou parado.
* **Círculos / Grupos:** Compartilhe o código (ex: `FAMILIA-01`) para que apenas as pessoas autorizadas vejam as posições.
* **Lugares Seguros (Geofencing):** Cadastre perímetros (Casa, Trabalho, Escola) e seja alertado automaticamente na chegada ou saída.
* **Botão de Emergência SOS:** Dispara aviso prioritário com alerta sonoro imediato para o grupo.
