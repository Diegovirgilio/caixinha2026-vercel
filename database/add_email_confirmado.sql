-- =============================================
-- ADICIONAR CAMPO EMAIL_CONFIRMADO
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Adicionar coluna email_confirmado
ALTER TABLE cotistas 
ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT false;

-- Atualizar cotistas existentes que já fizeram login
-- (se o user_id existe e o email está confirmado no auth.users)
UPDATE cotistas c
SET email_confirmado = true
WHERE c.user_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM auth.users u 
    WHERE u.id = c.user_id 
    AND u.email_confirmed_at IS NOT NULL
);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_cotistas_email_confirmado 
ON cotistas(email_confirmado);

-- =============================================
-- FUNÇÃO PARA ATUALIZAR email_confirmado 
-- QUANDO USUÁRIO CONFIRMAR EMAIL
-- =============================================

-- Criar função que será chamada quando o usuário confirmar email
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando email_confirmed_at for preenchido (confirmação de email)
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        UPDATE public.cotistas 
        SET email_confirmado = true 
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;

-- Criar trigger para quando o email for confirmado
CREATE TRIGGER on_email_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_email_confirmation();

-- =============================================
-- VERIFICAR E ATUALIZAR REGISTROS EXISTENTES
-- =============================================

-- Marcar como confirmado os cotistas que foram criados manualmente pelo admin
-- (esses não precisam confirmar email pois não têm user_id)
UPDATE cotistas 
SET email_confirmado = true 
WHERE user_id IS NULL;

-- Verificar status atual
SELECT 
    id, 
    nome, 
    email, 
    user_id,
    email_confirmado,
    status,
    is_admin
FROM cotistas 
ORDER BY created_at DESC;
