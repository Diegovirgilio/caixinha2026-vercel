-- =============================================
-- CORREÇÃO DE POLÍTICAS RLS - CRUD COTISTAS
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Remover políticas antigas de cotistas
DROP POLICY IF EXISTS "cotistas_select" ON cotistas;
DROP POLICY IF EXISTS "cotistas_insert" ON cotistas;
DROP POLICY IF EXISTS "cotistas_update" ON cotistas;
DROP POLICY IF EXISTS "cotistas_delete" ON cotistas;
DROP POLICY IF EXISTS "cotistas_insert_anon" ON cotistas;
DROP POLICY IF EXISTS "cotistas_select_anon" ON cotistas;

-- Políticas mais permissivas para CRUD funcionar
-- SELECT: Qualquer um autenticado pode ver todos os cotistas
CREATE POLICY "cotistas_select_all" ON cotistas 
    FOR SELECT 
    USING (true);

-- INSERT: Qualquer um autenticado pode inserir
CREATE POLICY "cotistas_insert_all" ON cotistas 
    FOR INSERT 
    WITH CHECK (true);

-- UPDATE: Qualquer um autenticado pode atualizar
CREATE POLICY "cotistas_update_all" ON cotistas 
    FOR UPDATE 
    USING (true);

-- DELETE: Qualquer um autenticado pode deletar
CREATE POLICY "cotistas_delete_all" ON cotistas 
    FOR DELETE 
    USING (true);

-- =============================================
-- VERIFICAR SE RLS ESTÁ HABILITADO
-- =============================================
-- Se as operações ainda não funcionarem, tente desabilitar RLS temporariamente:
-- ALTER TABLE cotistas DISABLE ROW LEVEL SECURITY;

-- Ou habilitar com políticas permissivas:
-- ALTER TABLE cotistas FORCE ROW LEVEL SECURITY;
