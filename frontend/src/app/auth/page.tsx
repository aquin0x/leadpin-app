"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Target, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase-client"
import toast from "react-hot-toast"

export default function AuthPage() {
  const router = useRouter()

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isRegisterLoading, setIsRegisterLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoginLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      toast.error(error.message)
      setIsLoginLoading(false)
      return
    }

    toast.success("Giriş başarılı!")
    router.push("/dashboard")
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (registerPassword.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır")
      return
    }

    setIsRegisterLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
    })

    if (error) {
      toast.error(error.message)
      setIsRegisterLoading(false)
      return
    }

    toast.success("Doğrulama emaili gönderildi")
    setIsRegisterLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-500/10 shadow-xl shadow-blue-500/5">
            <Target className="size-8 text-blue-400" />
          </div>
          <div>
            <h1 className="font-sans text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              LeadPin
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              İşletmeleri keşfedin, hedefleyin, kazanın
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-zinc-400">
                    E-posta
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-zinc-400">
                    Şifre
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {isLoginLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Giriş yapılıyor...
                    </>
                  ) : (
                    "Giriş Yap"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-zinc-400">
                    E-posta
                  </Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-zinc-400">
                    Şifre (min 6 karakter)
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={6}
                    className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {isRegisterLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Kayıt yapılıyor...
                    </>
                  ) : (
                    "Kayıt Ol"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
