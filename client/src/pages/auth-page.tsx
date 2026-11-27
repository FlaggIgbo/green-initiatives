import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { register, login, reset, verifyOTP, resendOTP } from "../features/auth/authSlice";
import { useTranslation } from "@/hooks/use-translation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getDetectedEnvironment } from "@/lib/api-config";
import { ENVIRONMENTS } from "@shared/schema-mongo";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoCredentials } from "@/components/auth/demo-credentials";
import type { RootState, AppDispatch } from "../app/store";

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { user, isLoading, isError, isSuccess, message, requiresOTP, otpUserId } = useSelector(
    (state: RootState) => state.auth,
  );

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);

  const currentEnv = getDetectedEnvironment();
  const isDevelopment = currentEnv === ENVIRONMENTS.development;
  const isSandbox = currentEnv === ENVIRONMENTS.sandbox;
  const isSandboxOrDev = isDevelopment || isSandbox;

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(message);
      dispatch(reset());
    }

    if (isSuccess || user) {
      navigate("/");
      dispatch(reset());
    }
  }, [user, isError, isSuccess, message, requiresOTP, navigate, dispatch]);

  function onSubmit(data: {
    username: string;
    password: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  }) {
    if (activeTab === "login") {
      dispatch(login({ username: data.username, password: data.password }));
    } else {
      dispatch(register(data));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background -mx-4 -my-8">
      <div className="grid lg:grid-cols-2 gap-8 w-full max-w-4xl mx-4">
        {requiresOTP ? (
          <Card className="lg:order-2">
            <CardHeader>
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We&apos;ve sent a 6-digit verification code to your email. Please enter it below to
                continue.
                {message && <p className="mt-2 text-primary font-semibold">{message}</p>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    id="otp"
                    placeholder="123456"
                    className="text-center text-2xl tracking-[1em] font-mono"
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.currentTarget as HTMLInputElement).value;
                        if (val.length === 6 && otpUserId) {
                          dispatch(verifyOTP({ userId: otpUserId, otp: val }));
                        }
                      }
                    }}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => {
                    const val = (document.getElementById("otp") as HTMLInputElement).value;
                    if (val.length === 6 && otpUserId) {
                      dispatch(verifyOTP({ userId: otpUserId, otp: val }));
                    } else {
                      toast.error("Please enter a valid 6-digit code");
                    }
                  }}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Code"}
                </Button>
                <div className="flex flex-col space-y-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs"
                    disabled={isLoading}
                    onClick={() => otpUserId && dispatch(resendOTP(otpUserId))}
                  >
                    Resend code
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={() => dispatch(reset())}
                  >
                    Back to login
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:order-2">
            <CardHeader>
              <CardTitle>{t.auth.page.title}</CardTitle>
              <CardDescription>{t.auth.page.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "login" | "register")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t.auth.page.loginTab}</TabsTrigger>
                  <TabsTrigger value="register">{t.auth.page.registerTab}</TabsTrigger>
                </TabsList>

                {isSandboxOrDev && activeTab === "login" && (
                  <DemoCredentials isSandbox={isSandbox} />
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="username"
                      rules={{ required: t.validation.required }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.auth.page.username}</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {activeTab === "register" && (
                      <>
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.auth.page.fullName}</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.auth.page.emailAddress}</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" autoComplete="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.auth.page.phoneNumber}</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" autoComplete="tel" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <FormField
                      control={form.control}
                      name="password"
                      rules={{ required: t.validation.required }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.auth.page.password}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                autoComplete={
                                  activeTab === "login" ? "current-password" : "new-password"
                                }
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword((prev) => !prev)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                          {activeTab === "login" && (
                            <div className="text-right">
                              <Button
                                variant="link"
                                size="sm"
                                className="px-0 font-normal text-xs"
                                onClick={() => navigate("/forgot-password")}
                                type="button"
                              >
                                Forgot password?
                              </Button>
                            </div>
                          )}
                        </FormItem>
                      )}
                    />

                    {/* TODO: Add a required checkbox for terms acceptance and prevent form submission until checked */}
                    {/* TODO: Add the same legal consent text to the entity registration page (register-entity.tsx) */}
                    {activeTab === "register" && (
                      <p className="text-xs text-muted-foreground text-center">
                        {t.auth.page.agreeToTerms}{" "}
                        <a
                          href="https://docs.google.com/document/d/1z2uFVSLxRA3Nd74C5qRwEO0-S87FW-k-/edit"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          {t.common.termsOfService}
                        </a>{" "}
                        {t.common.and}{" "}
                        <a
                          href="https://docs.google.com/document/d/1WRUei7Ua3kAricHv6KulE_rk_JfqyBAU/edit"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          {t.common.privacyNotice}
                        </a>
                        .
                      </p>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : activeTab === "login" ? (
                        t.auth.page.loginButton
                      ) : (
                        t.auth.page.registerButton
                      )}
                    </Button>

                    {activeTab === "register" && (
                      <div className="mt-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t.auth.page.entityRegisterPrompt}{" "}
                          <Button
                            variant="link"
                            className="p-0 h-auto font-semibold"
                            onClick={() => navigate("/register-entity")}
                          >
                            {t.auth.page.clickHere}
                          </Button>
                        </p>
                      </div>
                    )}
                  </form>
                </Form>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <div className="hidden lg:flex flex-col justify-center lg:order-1">
          <h1 className="text-4xl font-bold mb-4">{t.auth.page.heroTitle}</h1>
          <p className="text-lg text-muted-foreground">{t.auth.page.heroDescription}</p>
        </div>
      </div>
    </div>
  );
}
