import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      setError("用户名需 3-20 位字母、数字、_ 或 -");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("密码需 8-72 位");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "请求失败");
        return;
      }
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">星泊静态托管</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister ? "注册新账号" : "登录你的账号"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="3-20 位字母数字"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8-72 位"
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" disabled={busy}>
              {busy ? "提交中…" : isRegister ? "注册" : "登录"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:underline"
              onClick={() => {
                setIsRegister(v => !v);
                setError("");
              }}
            >
              {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
