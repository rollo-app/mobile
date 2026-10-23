import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { startEmailLogin, verifyCode } from "@/features/auth/actions";
import { AuthScreen } from "@/features/auth/auth-screen";
import { LOGIN_CODE_LENGTH, normalizeLoginCode } from "@/features/auth/login-code";
import { resendSecondsLeft } from "@/features/auth/resend";
import { Button, ErrorText, Field, Footnote } from "@/ui/components";

export default function CodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Only a failed verify suggests asking for another code (not a failed resend).
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = resendSecondsLeft(sentAt, now);

  async function submit(value: string) {
    setError(null);
    setVerifyFailed(false);
    setLoading(true);
    try {
      // The session flips the gate on its own: new accounts land on "Completá tu perfil", the rest in the app.
      await verifyCode(email, value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el código");
      setVerifyFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function change(text: string) {
    const next = normalizeLoginCode(text, code);
    setCode(next);
    if (next.length === LOGIN_CODE_LENGTH && !loading) void submit(next);
  }

  async function resend() {
    setError(null);
    setVerifyFailed(false);
    setResending(true);
    try {
      await startEmailLogin(email);
      // The old code is dead: clear it so the new one (typed or autofilled) isn't appended to it.
      setCode("");
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reenviar el código");
    } finally {
      setResending(false);
    }
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
      <Button label="Entrar" onPress={() => void submit(code)} disabled={code.length !== LOGIN_CODE_LENGTH} loading={loading} />
      <Button
        label={wait > 0 ? `Reenviar código (${wait} s)` : "Reenviar código"}
        variant="secondary"
        onPress={resend}
        disabled={wait > 0}
        loading={resending}
      />
    </AuthScreen>
  );
}

