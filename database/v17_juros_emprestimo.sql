-- =============================================
-- V17 - REGISTRO DE JUROS DE EMPRÉSTIMO
-- =============================================

-- 1. Criar tabela para registrar cada pagamento de juros
CREATE TABLE IF NOT EXISTS juros_emprestimo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emprestimo_id UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  cotista_id UUID REFERENCES cotistas(id) ON DELETE CASCADE,
  comprovante_id UUID REFERENCES comprovantes(id) ON DELETE SET NULL,
  modalidade VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal ou caixinha
  tipo_pagamento VARCHAR(20) NOT NULL, -- quitacao, soJuros, parcial
  valor_juros DECIMAL(10,2) NOT NULL,
  valor_principal_abatido DECIMAL(10,2) DEFAULT 0,
  taxa_juros DECIMAL(5,2) NOT NULL,
  mes_referencia VARCHAR(7),
  registrado_por UUID REFERENCES cotistas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar campo para controlar principal restante
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS principal_restante DECIMAL(10,2);

-- 3. Atualizar empréstimos existentes com principal_restante
UPDATE emprestimos 
SET principal_restante = valor_emprestimo 
WHERE principal_restante IS NULL;

-- 4. Para empréstimos já pagos, zerar principal_restante
UPDATE emprestimos 
SET principal_restante = 0 
WHERE status = 'pago' AND principal_restante IS NULL;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_juros_emprestimo_emprestimo ON juros_emprestimo(emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_juros_emprestimo_cotista ON juros_emprestimo(cotista_id);
CREATE INDEX IF NOT EXISTS idx_juros_emprestimo_modalidade ON juros_emprestimo(modalidade);

-- 6. RLS
ALTER TABLE juros_emprestimo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Juros emprestimo visivel para todos autenticados" ON juros_emprestimo
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Juros emprestimo insert para admins" ON juros_emprestimo
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
