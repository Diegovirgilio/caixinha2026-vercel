-- =============================================
-- CAIXINHA 2026 - ATUALIZAÇÃO V2
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. TRIGGER PARA DELETAR AUTH.USERS QUANDO COTISTA É EXCLUÍDO
-- =============================================

CREATE OR REPLACE FUNCTION delete_auth_user_on_cotista_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_cotista_delete ON cotistas;
CREATE TRIGGER on_cotista_delete
    BEFORE DELETE ON cotistas
    FOR EACH ROW
    EXECUTE FUNCTION delete_auth_user_on_cotista_delete();

-- =============================================
-- 2. LIMPAR USUÁRIOS ÓRFÃOS EXISTENTES
-- =============================================

-- Primeiro, veja quais são os órfãos (execute separadamente para verificar)
-- SELECT u.id, u.email, u.created_at
-- FROM auth.users u
-- LEFT JOIN cotistas c ON c.user_id = u.id
-- WHERE c.id IS NULL AND u.email != 'diegovirgilio@gmail.com';

-- Deletar órfãos (cuidado: não deleta o admin principal)
DELETE FROM auth.users 
WHERE id IN (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN cotistas c ON c.user_id = u.id
    WHERE c.id IS NULL 
    AND u.email != 'diegovirgilio@gmail.com'
);

-- =============================================
-- 3. TABELA DE COMPROVANTES
-- =============================================

CREATE TABLE IF NOT EXISTS comprovantes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('mensalidade', 'emprestimo')),
    referencia_id UUID NOT NULL, -- ID da mensalidade ou empréstimo
    mes_referencia VARCHAR(7), -- Para mensalidades: '2026-01', etc
    valor_informado DECIMAL(10,2) NOT NULL,
    arquivo_url TEXT NOT NULL,
    arquivo_nome VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    validacao_automatica BOOLEAN DEFAULT false,
    dados_extraidos JSONB, -- Dados extraídos do comprovante (OCR)
    motivo_rejeicao TEXT,
    validado_por UUID REFERENCES cotistas(id),
    data_validacao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comprovantes_cotista ON comprovantes(cotista_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_status ON comprovantes(status);
CREATE INDEX IF NOT EXISTS idx_comprovantes_tipo ON comprovantes(tipo);
CREATE INDEX IF NOT EXISTS idx_comprovantes_referencia ON comprovantes(referencia_id);

-- =============================================
-- 4. POLÍTICAS RLS PARA COMPROVANTES
-- =============================================

ALTER TABLE comprovantes ENABLE ROW LEVEL SECURITY;

-- Todos podem ver comprovantes
CREATE POLICY "comprovantes_select_all" ON comprovantes 
    FOR SELECT USING (true);

-- Todos podem inserir comprovantes
CREATE POLICY "comprovantes_insert_all" ON comprovantes 
    FOR INSERT WITH CHECK (true);

-- Todos podem atualizar comprovantes
CREATE POLICY "comprovantes_update_all" ON comprovantes 
    FOR UPDATE USING (true);

-- Todos podem deletar comprovantes
CREATE POLICY "comprovantes_delete_all" ON comprovantes 
    FOR DELETE USING (true);

-- =============================================
-- 5. ATUALIZAR STATUS DAS MENSALIDADES
-- =============================================

-- Adicionar novo status 'aguardando_aprovacao' se não existir
DO $$
BEGIN
    -- Remover constraint antiga se existir
    ALTER TABLE mensalidades DROP CONSTRAINT IF EXISTS mensalidades_status_check;
    
    -- Adicionar nova constraint com o status adicional
    ALTER TABLE mensalidades ADD CONSTRAINT mensalidades_status_check 
        CHECK (status IN ('pendente', 'parcial', 'pago', 'aguardando_aprovacao'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- =============================================
-- 6. ATUALIZAR STATUS DOS EMPRÉSTIMOS
-- =============================================

DO $$
BEGIN
    -- Remover constraint antiga se existir
    ALTER TABLE emprestimos DROP CONSTRAINT IF EXISTS emprestimos_status_check;
    
    -- Adicionar nova constraint com o status adicional
    ALTER TABLE emprestimos ADD CONSTRAINT emprestimos_status_check 
        CHECK (status IN ('pendente', 'aprovado', 'ativo', 'pago', 'rejeitado', 'cancelado', 'aguardando_aprovacao'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- =============================================
-- 7. FUNÇÃO PARA ATUALIZAR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comprovantes_updated_at ON comprovantes;
CREATE TRIGGER update_comprovantes_updated_at
    BEFORE UPDATE ON comprovantes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. CRIAR BUCKET PARA COMPROVANTES NO STORAGE
-- =============================================

-- Execute isso no SQL Editor ou via Dashboard:
-- Vá em Storage > New Bucket > Nome: "comprovantes" > Public: ON

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload
CREATE POLICY "Permitir upload de comprovantes" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "Permitir visualização de comprovantes" ON storage.objects
    FOR SELECT USING (bucket_id = 'comprovantes');

CREATE POLICY "Permitir delete de comprovantes" ON storage.objects
    FOR DELETE USING (bucket_id = 'comprovantes');

-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================

-- Verificar se tudo foi criado
SELECT 'Tabela comprovantes' as item, EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'comprovantes'
) as existe
UNION ALL
SELECT 'Trigger on_cotista_delete', EXISTS (
    SELECT FROM pg_trigger WHERE tgname = 'on_cotista_delete'
)
UNION ALL
SELECT 'Bucket comprovantes', EXISTS (
    SELECT FROM storage.buckets WHERE id = 'comprovantes'
);
