-- =============================================
-- CAIXINHA 2026 - SETUP INICIAL
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. PERMITIR 0 COTAS PARA ADMIN
-- =============================================

-- Remover constraint antiga
ALTER TABLE cotistas DROP CONSTRAINT IF EXISTS cotistas_cotas_check;

-- Nova constraint: 0 cotas só se for admin, senão mínimo 1
-- (Não é possível fazer isso com CHECK simples, então permitimos 0-50 
-- e validamos no código)
ALTER TABLE cotistas ADD CONSTRAINT cotistas_cotas_check CHECK (cotas >= 0 AND cotas <= 50);

-- =============================================
-- 2. ADICIONAR COLUNA TELEFONE (se não existir)
-- =============================================

ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_cotistas_telefone ON cotistas(telefone);

-- =============================================
-- 3. FIX TRIGGER EXCLUSÃO
-- =============================================

DROP TRIGGER IF EXISTS on_cotista_delete ON cotistas;

CREATE TRIGGER on_cotista_delete
    AFTER DELETE ON cotistas
    FOR EACH ROW
    EXECUTE FUNCTION delete_auth_user_on_cotista_delete();

-- =============================================
-- 4. CRIAR ADMINISTRADOR PADRÃO
-- =============================================

-- IMPORTANTE: Este passo deve ser feito MANUALMENTE no Supabase Dashboard:
-- 
-- 1. Vá em Authentication > Users
-- 2. Clique "Add User"
-- 3. Preencha:
--    - Email: admin@caixinha2026.app
--    - Password: 123456
--    - Marque "Auto Confirm User"
-- 4. Clique "Create User"
-- 5. Copie o UUID do usuário criado
-- 6. Execute o SQL abaixo substituindo 'UUID_DO_ADMIN' pelo UUID copiado:

/*
INSERT INTO cotistas (user_id, nome, email, cotas, is_admin, status, email_confirmado)
VALUES (
    'UUID_DO_ADMIN',  -- Substitua pelo UUID do usuário criado
    'Administrador',
    'admin@caixinha2026.app',
    0,
    true,
    'ativo',
    true
);
*/

-- =============================================
-- OU USE ESTE MÉTODO ALTERNATIVO (mais fácil):
-- =============================================

-- Se você JÁ TEM um admin criado e quer apenas atualizar para 0 cotas:

UPDATE cotistas 
SET cotas = 0 
WHERE is_admin = true;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

SELECT 
    nome, 
    email, 
    cotas, 
    is_admin,
    email_confirmado
FROM cotistas 
WHERE is_admin = true;
