import { ChevronLeft, Camera, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useApp } from "../contexts/AppContext";
import { supabase } from "../lib/supabase";

export function EditProfile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { setNickname } = useApp();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const avatarUrl = avatarPreview ?? profile?.avatar_url ?? null;
  const initial = (username || profile?.username || "?").charAt(0).toUpperCase();

  function onPickAvatar(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있어요.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("8MB 이하 이미지를 사용해주세요.");
      return;
    }
    setAvatarFile(file);
  }

  async function uploadAvatar() {
    if (!user || !avatarFile) return profile?.avatar_url ?? null;
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatarFile, {
        cacheControl: "3600",
        contentType: avatarFile.type || "image/jpeg",
        upsert: true,
      });
    if (uploadError) throw uploadError;
    return supabase.storage.from("avatars").getPublicUrl(filePath).data.publicUrl;
  }

  const handleSave = async () => {
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const nextAvatarUrl = await uploadAvatar();
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() || null, avatar_url: nextAvatarUrl })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setNickname(username.trim() || "이름");
      setAvatarFile(null);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        navigate(-1);
      }, 800);
    } catch (e) {
      console.error("프로필 저장 실패:", e);
      setError(e instanceof Error ? e.message : "프로필 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F6FA] overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-12 pb-4 bg-white border-b border-slate-100">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-[17px] font-black text-slate-900">프로필 수정</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 flex items-center gap-1.5 rounded-full font-bold text-[13px] transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: saved ? "#22c55e" : "linear-gradient(135deg, #FF3355, #ff5570)",
            color: "white",
          }}
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? "저장됨" : "저장"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 프로필 사진 */}
        <div className="flex flex-col items-center pt-8 pb-6 bg-white border-b border-slate-100">
          <div className="relative mb-3">
            <div
              className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden"
              style={{
                border: "3px solid #FF3355",
                boxShadow: "0 0 0 3px white, 0 6px 20px rgba(255,51,85,0.2)",
                ...(avatarUrl ? { backgroundImage: `url("${avatarUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
              }}
            >
              {!avatarUrl && (
                <span className="text-3xl font-black text-slate-400">{initial}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-white shadow-lg text-white"
              style={{ background: "linear-gradient(135deg, #FF3355, #ff5570)" }}
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onPickAvatar(e.target.files?.[0])}
            />
          </div>
          <p className="text-[12px] text-slate-400 font-medium">
            {avatarFile ? "저장을 누르면 사진이 변경돼요" : "탭해서 사진 변경"}
          </p>
          {error && <p className="text-[12px] text-red-500 font-medium mt-2 px-6 text-center">{error}</p>}
        </div>

        {/* 입력 필드 */}
        <div className="px-4 pt-5 pb-8">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1 mb-2 block">닉네임</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="닉네임 입력"
            className="w-full h-14 px-5 rounded-2xl border border-slate-200 bg-white text-slate-900 text-[15px] font-medium focus:outline-none focus:border-[#FF3355] transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
