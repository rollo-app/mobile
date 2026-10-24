import { useEffect, useState } from "react";
import { errorMessage } from "@/api/client";
import { Button, ErrorText, Field, Footnote } from "@/ui/components";
import { AuthScreen } from "./auth-screen";
import { LOGIN_CODE_LENGTH, normalizeLoginCode } from "./login-code";
import { resendSecondsLeft } from "./resend";
import { useStartEmailLogin } from "./use-start-email-login";
import { useVerifyCode } from "./use-verify-code";

export function CodeScreen({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const verify = useVerifyCode();
  const resend = useStartEmailLogin();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = resendSecondsLeft(sentAt, now);

  // One error at a time: starting either mutation resets the other.
  const error = errorMessage(verify.error, "No se pudo verificar el código") ?? errorMessage(resend.error, "No se pudo reenviar el código");
  // Only a failed verify suggests asking for another code (not a failed resend).
  const verifyFailed = verify.isError;

  function submit(value: string) {
    resend.reset();
    // The session flips the gate on its own: new accounts land on "Completá tu perfil", the rest in the app.
    verify.mutate({ email, code: value });
  }

  function change(text: string) {
    const next = normalizeLoginCode(text, code);
    setCode(next);
    if (next.length === LOGIN_CODE_LENGTH && !verify.isPending) submit(next);
  }

  function resendCode() {
    verify.reset();
    resend.mutate(email, {
      onSuccess: () => {
        // The old code is dead: clear it so the new one (typed or autofilled) isn't appended to it.
        setCode("");
        setSentAt(Date.now());
        setNow(Date.now());
      },
    });
  }

  return (
    <AuthScreen title="Revisá tu mail" subtitle={`Te mandamos un código de 6 caracteres a ${email}. Vale 5 minutos.`}>
      <Field
        label="Código"
        value={code}
        onChangeText={change}
        keyboardType="default"
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        // No native maxLength: iOS AutoFill can drop an insertion that goes over it. normalizeLoginCode trims instead.
        autoFocus
        placeholder="K7M4QX"
      />
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          {/* iOS can delete the mail after autofilling the code ("Delete after use"). */}
          {verifyFailed && <Footnote>Si el mail se borró, pedí otro código.</Footnote>}
        </>
      )}
      <Button label="Entrar" onPress={() => submit(code)} disabled={code.length !== LOGIN_CODE_LENGTH} loading={verify.isPending} />
      <Button
        label={wait > 0 ? `Reenviar código (${wait} s)` : "Reenviar código"}
        variant="secondary"
        onPress={resendCode}
        disabled={wait > 0}
        loading={resend.isPending}
      />
    </AuthScreen>
  );
}
