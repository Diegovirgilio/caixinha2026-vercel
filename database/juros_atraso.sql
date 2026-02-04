-- =============================================
-- TABELA DE JUROS POR ATRASO
-- =============================================

-- Tabela para registrar juros cobrados por atraso em mensalidades e empréstimos
CREATE TABLE IF NOT EXISTS juros_atraso (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
    comprovante_id UUID REFERENCES comprovantes(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('mensalidade', 'emprestimo')),
    valor_juros DECIMAL(10,2) NOT NULL,
    mes_referencia VARCHAR(7), -- Para mensalidades: '01/2026'
    observacao TEXT,
    registrado_por UUID REFERENCES cotistas(id), -- Admin que registrou
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_juros_atraso_cotista ON juros_atraso(cotista_id);
CREATE INDEX IF NOT EXISTS idx_juros_atraso_tipo ON juros_atraso(tipo);
CREATE INDEX IF NOT EXISTS idx_juros_atraso_mes ON juros_atraso(mes_referencia);

-- RLS (Row Level Security)
ALTER TABLE juros_atraso ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ver
CREATE POLICY "juros_atraso_select" ON juros_atraso
    FOR SELECT USING (true);

-- Política: Apenas admins podem inserir/atualizar/deletar
CREATE POLICY "juros_atraso_insert" ON juros_atraso
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM cotistas WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "juros_atraso_update" ON juros_atraso
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM cotistas WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "juros_atraso_delete" ON juros_atraso
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM cotistas WHERE id = auth.uid() AND is_admin = true)
    );

-- =============================================
-- ADICIONAR COLUNA observacao NA TABELA comprovantes (se não existir)
-- =============================================
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS observacao TEXT;

-- =============================================
-- ADICIONAR COLUNAS NA TABELA rifa_sorteios (se não existirem)
-- =============================================
ALTER TABLE rifa_sorteios ADD COLUMN IF NOT EXISTS vencedores JSONB;
ALTER TABLE rifa_sorteios ALTER COLUMN numero_vencedor TYPE VARCHAR(50);
