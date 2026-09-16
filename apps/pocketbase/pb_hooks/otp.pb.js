routerAdd("POST", "/api/easyhabit/request-otp", (c) => {
  try {
    const registrationAccessCode = "uNqcJ3wJMvco6avezBERug";
    const normalizePhone = (value) => {
      let normalized = (value || "").toString().replace(/\D/g, "");
      if (normalized.length === 10 || normalized.length === 11) {
        normalized = "55" + normalized;
      }
      return normalized;
    };
    const findUser = (filter, params) => {
      try {
        return $app.findFirstRecordByFilter("users", filter, params);
      } catch (err) {
        return null;
      }
    };
    const getAvailability = (phone, username, email) => {
      const virtualEmail = `${phone}@whatsapp.easyhabit.local`;
      const phoneOwner = findUser(
        "phone = {:phone} || email = {:virtualEmail}",
        { phone: phone, virtualEmail: virtualEmail }
      );
      const legacyUser = phoneOwner &&
        !phoneOwner.get("username") &&
        phoneOwner.get("email") === virtualEmail
          ? phoneOwner
          : null;
      const legacyId = legacyUser ? legacyUser.get("id") : "";
      const usernameOwner = findUser("username = {:username}", { username: username });
      const emailOwner = email ? findUser("email = {:email}", { email: email }) : null;
      return {
        username: !usernameOwner || usernameOwner.get("id") === legacyId,
        email: !emailOwner || emailOwner.get("id") === legacyId,
        phone: !phoneOwner || !!legacyUser
      };
    };

    let data = {};
    try {
      if (c.requestInfo) {
        data = c.requestInfo().body || {};
      }
    } catch (e1) {}

    if (!data.phone) {
      try {
        if (typeof $apis !== "undefined" && $apis.requestInfo) {
          data = $apis.requestInfo(c).data || {};
        }
      } catch (e2) {}
    }

    if (!data.phone) {
      try {
        const bodyObj = {};
        c.bindBody(bodyObj);
        data = bodyObj;
      } catch (e3) {}
    }

    const phone = normalizePhone(data.phone || data.number || "");
    const purpose = (data.purpose || "register").toString().trim();

    if (!phone || phone.length < 10) {
      return c.json(400, { message: "Informe um número de telefone válido com DDD (ex: 83999999999)." });
    }

    if (purpose !== "register" && purpose !== "reset") {
      return c.json(400, { message: "Finalidade do código de verificação inválida." });
    }

    if (purpose === "register") {
      const username = (data.username || "").toString().trim().toLowerCase();
      const email = (data.email || "").toString().trim().toLowerCase();
      const inviteCode = (data.inviteCode || "").toString().trim();

      if (inviteCode !== registrationAccessCode) {
        return c.json(403, { message: "Código de acesso inválido." });
      }

      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return c.json(400, {
          message: "O nome de usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado."
        });
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return c.json(400, { message: "Informe um e-mail válido ou deixe o campo vazio." });
      }

      const availability = getAvailability(phone, username, email);
      const conflicts = [];
      if (!availability.username) conflicts.push("nome de usuário");
      if (!availability.email) conflicts.push("e-mail");
      if (!availability.phone) conflicts.push("número de celular");
      const availabilityMessage = conflicts.length
        ? "Já existe uma conta usando: " + conflicts.join(", ") + ". Escolha outros dados ou entre na conta existente."
        : "";
      if (availabilityMessage) {
        return c.json(409, {
          message: availabilityMessage,
          availability: {
            username: availability.username,
            email: availability.email,
            phone: availability.phone
          }
        });
      }
    } else {
      const virtualEmail = `${phone}@whatsapp.easyhabit.local`;
      const user = findUser(
        "phone = {:phone} || email = {:virtualEmail}",
        { phone: phone, virtualEmail: virtualEmail }
      );
      if (!user) {
        return c.json(400, { message: "Nenhuma conta encontrada vinculada a este número." });
      }
    }

    try {
      const since = new Date(Date.now() - 60 * 1000).toISOString();
      const recentOtps = $app.findRecordsByFilter(
        "phone_otps",
        "phone = {:phone} && purpose = {:purpose} && used = false && created >= {:since}",
        "-created",
        1,
        0,
        { phone: phone, purpose: purpose, since: since }
      );
      if (recentOtps && recentOtps.length > 0) {
        return c.json(429, { message: "Aguarde um minuto antes de solicitar outro código." });
      }
    } catch (rateLimitError) {
      console.log("[OTP rate-limit Error]: " + rateLimitError);
    }

    const apiUrl = ($os.getenv("EVOLUTION_API_URL") || "").trim();
    const apiKey = ($os.getenv("EVOLUTION_API_KEY") || "").trim();
    const instanceName = ($os.getenv("EVOLUTION_INSTANCE_NAME") || "").trim();

    if (!apiUrl || !apiKey || !instanceName) {
      return c.json(400, {
        message: "Integração WhatsApp não configurada no .env. Preencha EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME."
      });
    }

    // Gerar código aleatório de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Salvar o OTP no banco
    const otpsColl = $app.findCollectionByNameOrId("phone_otps");
    const record = new Record(otpsColl);
    record.set("phone", phone);
    record.set("code", code);
    record.set("purpose", purpose);
    record.set("expires_at", expiresAt);
    record.set("used", false);
    $app.save(record);

    // Disparar requisição HTTP para a Evolution API
    const cleanBaseUrl = apiUrl.replace(/\/+$/, "");
    const encodedInstance = encodeURIComponent(instanceName);
    const targetUrl = `${cleanBaseUrl}/message/sendText/${encodedInstance}`;
    const messageText = `Seu código de acesso ao *EasyHabit* é: *${code}*\n\nEste código expira em 5 minutos.`;

    const res = $http.send({
      url: targetUrl,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": apiKey
      },
      body: JSON.stringify({
        number: phone,
        text: messageText
      }),
      timeout: 15
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      let errMsg = `Falha na Evolution API (Status ${res.statusCode}). Verifique se a instância '${instanceName}' está conectada.`;
      try {
        const errJson = JSON.parse(res.raw);
        if (errJson.response && Array.isArray(errJson.response.message) && errJson.response.message[0] && errJson.response.message[0].exists === false) {
          errMsg = "Este número não possui uma conta ativa no WhatsApp. Verifique se digitou o DDD e o número corretamente.";
        } else if (errJson.message) {
          errMsg = Array.isArray(errJson.message) ? errJson.message.join(", ") : String(errJson.message);
        }
      } catch (e) {}

      return c.json(400, { message: errMsg });
    }

    return c.json(200, {
      success: true,
      message: "Código de verificação enviado para o seu WhatsApp!"
    });
  } catch (err) {
    return c.json(500, {
      message: "Erro interno no servidor ao processar OTP: " + (err.message || err)
    });
  }
});

routerAdd("POST", "/api/easyhabit/verify-otp", (c) => {
  try {
    const registrationAccessCode = "uNqcJ3wJMvco6avezBERug";
    const normalizePhone = (value) => {
      let normalized = (value || "").toString().replace(/\D/g, "");
      if (normalized.length === 10 || normalized.length === 11) {
        normalized = "55" + normalized;
      }
      return normalized;
    };
    const findUser = (filter, params) => {
      try {
        return $app.findFirstRecordByFilter("users", filter, params);
      } catch (err) {
        return null;
      }
    };
    const getAvailability = (phone, username, email) => {
      const virtualEmail = `${phone}@whatsapp.easyhabit.local`;
      const phoneOwner = findUser(
        "phone = {:phone} || email = {:virtualEmail}",
        { phone: phone, virtualEmail: virtualEmail }
      );
      const legacyUser = phoneOwner &&
        !phoneOwner.get("username") &&
        phoneOwner.get("email") === virtualEmail
          ? phoneOwner
          : null;
      const legacyId = legacyUser ? legacyUser.get("id") : "";
      const usernameOwner = findUser("username = {:username}", { username: username });
      const emailOwner = email ? findUser("email = {:email}", { email: email }) : null;
      return {
        username: !usernameOwner || usernameOwner.get("id") === legacyId,
        email: !emailOwner || emailOwner.get("id") === legacyId,
        phone: !phoneOwner || !!legacyUser,
        legacyUser: legacyUser
      };
    };

    let data = {};
    try {
      if (c.requestInfo) {
        data = c.requestInfo().body || {};
      }
    } catch (e1) {}

    if (!data.phone) {
      try {
        if (typeof $apis !== "undefined" && $apis.requestInfo) {
          data = $apis.requestInfo(c).data || {};
        }
      } catch (e2) {}
    }

    if (!data.phone) {
      try {
        const bodyObj = {};
        c.bindBody(bodyObj);
        data = bodyObj;
      } catch (e3) {}
    }

    const phone = normalizePhone(data.phone || data.number || "");
    const code = (data.code || "").toString().trim();
    const username = (data.username || "").toString().trim().toLowerCase();
    const email = (data.email || "").toString().trim().toLowerCase();
    const password = (data.password || "").toString();
    const passwordConfirm = (data.passwordConfirm || "").toString();
    const inviteCode = (data.inviteCode || "").toString().trim();

    if (!phone || !code || !username || !password || !passwordConfirm) {
      return c.json(400, {
        message: "Telefone, código, nome de usuário, senha e confirmação são obrigatórios."
      });
    }

    if (inviteCode !== registrationAccessCode) {
      return c.json(403, { message: "Código de acesso inválido." });
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return c.json(400, {
        message: "O nome de usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado."
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json(400, { message: "Informe um e-mail válido ou deixe o campo vazio." });
    }

    if (password.length < 8) {
      return c.json(400, { message: "A senha deve ter no mínimo 8 caracteres." });
    }

    if (password !== passwordConfirm) {
      return c.json(400, { message: "A senha e a confirmação não coincidem." });
    }

    const availability = getAvailability(phone, username, email);
    const conflicts = [];
    if (!availability.username) conflicts.push("nome de usuário");
    if (!availability.email) conflicts.push("e-mail");
    if (!availability.phone) conflicts.push("número de celular");
    const availabilityMessage = conflicts.length
      ? "Já existe uma conta usando: " + conflicts.join(", ") + ". Escolha outros dados ou entre na conta existente."
      : "";
    if (availabilityMessage) {
      return c.json(409, {
        message: availabilityMessage,
        availability: {
          username: availability.username,
          email: availability.email,
          phone: availability.phone
        }
      });
    }

    let otpRecord;
    try {
      const records = $app.findRecordsByFilter(
        "phone_otps",
        "phone = {:phone} && code = {:code} && purpose = 'register' && used = false",
        "-created",
        1,
        0,
        { phone: phone, code: code }
      );
      if (records && records.length > 0) {
        otpRecord = records[0];
      }
    } catch (err) {
      console.log("[OTP verify-otp findFilter Error]: " + err);
      throw err;
    }

    if (!otpRecord) {
      return c.json(400, { message: "Código incorreto. Verifique os 6 dígitos digitados." });
    }

    const expTime = new Date(otpRecord.get("expires_at")).getTime();
    if (isNaN(expTime) || expTime < Date.now()) {
      return c.json(400, { message: "Código expirado. Por favor solicite um novo código no WhatsApp." });
    }

    const virtualEmail = `${phone}@whatsapp.easyhabit.local`;
    let userRecord = availability.legacyUser;

    if (!userRecord) {
      const usersColl = $app.findCollectionByNameOrId("users");
      userRecord = new Record(usersColl);
    }

    userRecord.set("username", username);
    userRecord.set("name", username);
    userRecord.set("email", email || virtualEmail);
    userRecord.set("phone", phone);
    userRecord.set("password", password);
    userRecord.set("passwordConfirm", passwordConfirm);
    $app.save(userRecord);

    otpRecord.set("used", true);
    $app.save(otpRecord);

    return $apis.recordAuthResponse(c, userRecord, "otp");
  } catch (err) {
    return c.json(500, {
      message: "Erro interno no servidor ao verificar código: " + (err.message || err)
    });
  }
});

routerAdd("POST", "/api/easyhabit/reset-password-otp", (c) => {
  try {
    let data = {};
    try {
      if (c.requestInfo) {
        data = c.requestInfo().body || {};
      }
    } catch (e1) {}

    if (!data.phone) {
      try {
        if (typeof $apis !== "undefined" && $apis.requestInfo) {
          data = $apis.requestInfo(c).data || {};
        }
      } catch (e2) {}
    }

    if (!data.phone) {
      try {
        const bodyObj = {};
        c.bindBody(bodyObj);
        data = bodyObj;
      } catch (e3) {}
    }

    const rawPhone = data.phone || data.number || "";
    let phone = rawPhone.toString().replace(/\D/g, "");

    if (phone.length === 10 || phone.length === 11) {
      phone = "55" + phone;
    }

    const code = (data.code || "").toString().trim();
    const newPassword = (data.newPassword || "").toString().trim();

    if (!phone || !code || !newPassword) {
      return c.json(400, { message: "Telefone, código e nova senha são obrigatórios." });
    }

    if (newPassword.length < 8) {
      return c.json(400, { message: "A nova senha deve ter no mínimo 8 caracteres." });
    }

    let otpRecord;
    try {
      const records = $app.findRecordsByFilter(
        "phone_otps",
        "phone = {:phone} && code = {:code} && purpose = 'reset' && used = false",
        "-created",
        1,
        0,
        { phone: phone, code: code }
      );
      if (records && records.length > 0) {
        otpRecord = records[0];
      }
    } catch (err) {
      console.log("[OTP reset-password findFilter Error]: " + err);
      throw err;
    }

    if (!otpRecord) {
      return c.json(400, { message: "Código incorreto. Verifique os 6 dígitos." });
    }

    const expTime = new Date(otpRecord.get("expires_at")).getTime();
    if (isNaN(expTime) || expTime < Date.now()) {
      return c.json(400, { message: "Código expirado. Solicite um novo código no WhatsApp." });
    }

    const virtualEmail = `${phone}@whatsapp.easyhabit.local`;
    let userRecord;

    try {
      userRecord = $app.findFirstRecordByFilter(
        "users",
        "phone = {:phone} || email = {:email}",
        { phone: phone, email: virtualEmail }
      );
    } catch (err) {
      return c.json(400, { message: "Nenhuma conta encontrada vinculada a este número." });
    }

    if (!userRecord.get("phone")) {
      userRecord.set("phone", phone);
    }

    // Atualizar a senha
    otpRecord.set("used", true);
    $app.save(otpRecord);

    userRecord.set("password", newPassword);
    userRecord.set("passwordConfirm", newPassword);
    $app.save(userRecord);

    return $apis.recordAuthResponse(c, userRecord, "otp");
  } catch (err) {
    return c.json(500, {
      message: "Erro interno no servidor ao redefinir senha: " + (err.message || err)
    });
  }
});
