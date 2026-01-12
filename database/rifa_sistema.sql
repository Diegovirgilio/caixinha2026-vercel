-- =============================================
-- SISTEMA DE RIFAS - Caixinha 2026
-- =============================================

-- 1. Adicionar campo participa_rifa na tabela cotistas
ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS participa_rifa BOOLEAN DEFAULT false;

-- 2. Tabela de números da rifa
CREATE TABLE IF NOT EXISTS rifa_numeros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
  numero VARCHAR(3) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Número único entre cotistas ativos
  CONSTRAINT unique_numero_ativo UNIQUE (numero)
);

-- Índice para busca rápida por cotista
CREATE INDEX IF NOT EXISTS idx_rifa_numeros_cotista ON rifa_numeros(cotista_id);

-- Índice para busca por número
CREATE INDEX IF NOT EXISTS idx_rifa_numeros_numero ON rifa_numeros(numero) WHERE ativo = true;

-- 3. Tabela de sorteios mensais
CREATE TABLE IF NOT EXISTS rifa_sorteios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mes_referencia VARCHAR(7) NOT NULL, -- '01/2026'
  data_sorteio DATE NOT NULL,
  numero_vencedor VARCHAR(3),
  cotista_vencedor_id UUID REFERENCES cotistas(id) ON DELETE SET NULL,
  valor_arrecadado DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_premio DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_caixinha DECIMAL(10,2) NOT NULL DEFAULT 0,
  resultado_federal JSONB, -- {primeiro: "12345", segundo: "67890", ...}
  premios_verificados JSONB, -- lista de números verificados até achar vencedor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Um sorteio por mês
  CONSTRAINT unique_sorteio_mes UNIQUE (mes_referencia)
);

-- 4. RLS (Row Level Security)
ALTER TABLE rifa_numeros ENABLE ROW LEVEL SECURITY;
ALTER TABLE rifa_sorteios ENABLE ROW LEVEL SECURITY;

-- Políticas para rifa_numeros
DROP POLICY IF EXISTS "rifa_numeros_select" ON rifa_numeros;
CREATE POLICY "rifa_numeros_select" ON rifa_numeros
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "rifa_numeros_insert" ON rifa_numeros;
CREATE POLICY "rifa_numeros_insert" ON rifa_numeros
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "rifa_numeros_update" ON rifa_numeros;
CREATE POLICY "rifa_numeros_update" ON rifa_numeros
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "rifa_numeros_delete" ON rifa_numeros;
CREATE POLICY "rifa_numeros_delete" ON rifa_numeros
  FOR DELETE USING (true);

-- Políticas para rifa_sorteios
DROP POLICY IF EXISTS "rifa_sorteios_select" ON rifa_sorteios;
CREATE POLICY "rifa_sorteios_select" ON rifa_sorteios
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "rifa_sorteios_insert" ON rifa_sorteios;
CREATE POLICY "rifa_sorteios_insert" ON rifa_sorteios
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "rifa_sorteios_update" ON rifa_sorteios;
CREATE POLICY "rifa_sorteios_update" ON rifa_sorteios
  FOR UPDATE USING (true);

-- 5. Função para gerar números únicos aleatórios
CREATE OR REPLACE FUNCTION gerar_numeros_rifa(p_cotista_id UUID, p_quantidade INT)
RETURNS SETOF VARCHAR(3) AS $$
DECLARE
  v_numero VARCHAR(3);
  v_count INT := 0;
  v_tentativas INT := 0;
BEGIN
  WHILE v_count < p_quantidade AND v_tentativas < 1000 LOOP
    -- Gerar número aleatório de 000 a 999
    v_numero := LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Verificar se não existe
    IF NOT EXISTS (SELECT 1 FROM rifa_numeros WHERE numero = v_numero AND ativo = true) THEN
      -- Inserir número
      INSERT INTO rifa_numeros (cotista_id, numero, ativo)
      VALUES (p_cotista_id, v_numero, true);
      
      v_count := v_count + 1;
      RETURN NEXT v_numero;
    END IF;
    
    v_tentativas := v_tentativas + 1;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 6. Função para remover números aleatórios
CREATE OR REPLACE FUNCTION remover_numeros_rifa(p_cotista_id UUID, p_quantidade INT)
RETURNS VOID AS $$
DECLARE
  v_numero_id UUID;
BEGIN
  FOR i IN 1..p_quantidade LOOP
    -- Selecionar um número aleatório do cotista
    SELECT id INTO v_numero_id
    FROM rifa_numeros
    WHERE cotista_id = p_cotista_id AND ativo = true
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Deletar o número
    IF v_numero_id IS NOT NULL THEN
      DELETE FROM rifa_numeros WHERE id = v_numero_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Função para processar vitória (remove número vencedor + 1 aleatório)
CREATE OR REPLACE FUNCTION processar_vitoria_rifa(p_cotista_id UUID, p_numero_vencedor VARCHAR(3))
RETURNS VOID AS $$
DECLARE
  v_numeros_restantes INT;
BEGIN
  -- Remover número vencedor
  DELETE FROM rifa_numeros 
  WHERE cotista_id = p_cotista_id AND numero = p_numero_vencedor;
  
  -- Remover 1 número aleatório
  PERFORM remover_numeros_rifa(p_cotista_id, 1);
  
  -- Verificar quantos números restam
  SELECT COUNT(*) INTO v_numeros_restantes
  FROM rifa_numeros
  WHERE cotista_id = p_cotista_id AND ativo = true;
  
  -- Se não tem mais números, desativar participação
  IF v_numeros_restantes = 0 THEN
    UPDATE cotistas SET participa_rifa = false WHERE id = p_cotista_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissões
GRANT ALL ON rifa_numeros TO authenticated;
GRANT ALL ON rifa_sorteios TO authenticated;
GRANT EXECUTE ON FUNCTION gerar_numeros_rifa TO authenticated;
GRANT EXECUTE ON FUNCTION remover_numeros_rifa TO authenticated;
GRANT EXECUTE ON FUNCTION processar_vitoria_rifa TO authenticated;
