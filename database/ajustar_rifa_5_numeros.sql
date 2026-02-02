-- =============================================
-- AJUSTE: Números da Rifa de 2 para 5 por cota
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Verificar situação atual (opcional - diagnóstico)
-- SELECT 
--   c.nome, 
--   c.cotas,
--   c.participa_rifa,
--   COUNT(rn.id) as numeros_atuais,
--   c.cotas * 5 as numeros_esperados,
--   (c.cotas * 5) - COUNT(rn.id) as faltando
-- FROM cotistas c
-- LEFT JOIN rifa_numeros rn ON rn.cotista_id = c.id AND rn.ativo = true
-- WHERE c.participa_rifa = true AND c.is_admin = false
-- GROUP BY c.id, c.nome, c.cotas, c.participa_rifa
-- ORDER BY c.nome;

-- 2. Função para gerar números faltantes para um cotista
CREATE OR REPLACE FUNCTION ajustar_numeros_rifa_5_por_cota()
RETURNS TABLE(cotista_nome TEXT, numeros_gerados INT) AS $$
DECLARE
  v_cotista RECORD;
  v_numeros_atuais INT;
  v_numeros_necessarios INT;
  v_faltando INT;
  v_numero VARCHAR(3);
  v_gerados INT;
  v_tentativas INT;
BEGIN
  -- Loop por cada cotista que participa da rifa
  FOR v_cotista IN 
    SELECT id, nome, cotas 
    FROM cotistas 
    WHERE participa_rifa = true AND is_admin = false
  LOOP
    -- Contar números atuais
    SELECT COUNT(*) INTO v_numeros_atuais
    FROM rifa_numeros
    WHERE cotista_id = v_cotista.id AND ativo = true;
    
    -- Calcular quantos precisa (5 por cota)
    v_numeros_necessarios := v_cotista.cotas * 5;
    v_faltando := v_numeros_necessarios - v_numeros_atuais;
    
    -- Se precisa gerar mais
    IF v_faltando > 0 THEN
      v_gerados := 0;
      v_tentativas := 0;
      
      WHILE v_gerados < v_faltando AND v_tentativas < 5000 LOOP
        -- Gerar número aleatório
        v_numero := LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
        
        -- Verificar se não existe
        IF NOT EXISTS (SELECT 1 FROM rifa_numeros WHERE numero = v_numero AND ativo = true) THEN
          -- Inserir
          INSERT INTO rifa_numeros (cotista_id, numero, ativo)
          VALUES (v_cotista.id, v_numero, true);
          
          v_gerados := v_gerados + 1;
        END IF;
        
        v_tentativas := v_tentativas + 1;
      END LOOP;
      
      cotista_nome := v_cotista.nome;
      numeros_gerados := v_gerados;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 3. Executar o ajuste
SELECT * FROM ajustar_numeros_rifa_5_por_cota();

-- 4. Verificar resultado final (opcional)
-- SELECT 
--   c.nome, 
--   c.cotas,
--   COUNT(rn.id) as numeros_atuais,
--   c.cotas * 5 as numeros_esperados
-- FROM cotistas c
-- LEFT JOIN rifa_numeros rn ON rn.cotista_id = c.id AND rn.ativo = true
-- WHERE c.participa_rifa = true AND c.is_admin = false
-- GROUP BY c.id, c.nome, c.cotas
-- ORDER BY c.nome;

-- 5. Limpar função (opcional, após confirmar que funcionou)
-- DROP FUNCTION IF EXISTS ajustar_numeros_rifa_5_por_cota();
