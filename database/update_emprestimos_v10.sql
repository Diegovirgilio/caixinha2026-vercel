-- =============================================
-- ATUALIZAÇÃO: Sistema de Empréstimos V10
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Adicionar coluna chave_pix na tabela emprestimos
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255);

-- 2. Adicionar coluna para controle de pagamentos parciais
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS valor_pago_juros DECIMAL(10,2) DEFAULT 0;
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS valor_pago_principal DECIMAL(10,2) DEFAULT 0;

-- 3. Criar tabela de pagamentos de empréstimo (histórico)
CREATE TABLE IF NOT EXISTS emprestimo_pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emprestimo_id UUID NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  tipo_pagamento VARCHAR(20) NOT NULL CHECK (tipo_pagamento IN ('quitacao', 'soJuros', 'parcial')),
  valor_pago DECIMAL(10,2) NOT NULL,
  valor_juros DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_principal DECIMAL(10,2) NOT NULL DEFAULT 0,
  taxa_juros DECIMAL(5,2) NOT NULL,
  comprovante_url TEXT,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por UUID REFERENCES cotistas(id),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RLS para emprestimo_pagamentos
ALTER TABLE emprestimo_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emprestimo_pagamentos_select" ON emprestimo_pagamentos;
CREATE POLICY "emprestimo_pagamentos_select" ON emprestimo_pagamentos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "emprestimo_pagamentos_insert" ON emprestimo_pagamentos;
CREATE POLICY "emprestimo_pagamentos_insert" ON emprestimo_pagamentos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "emprestimo_pagamentos_update" ON emprestimo_pagamentos;
CREATE POLICY "emprestimo_pagamentos_update" ON emprestimo_pagamentos
  FOR UPDATE USING (true);

-- 5. Grant permissões
GRANT ALL ON emprestimo_pagamentos TO authenticated;

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_emprestimo_pagamentos_emprestimo ON emprestimo_pagamentos(emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_emprestimo_pagamentos_status ON emprestimo_pagamentos(status);
