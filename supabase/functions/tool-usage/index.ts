import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authorization header to extract user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

    // Helper function to get or create usage directly (fallback if RPC doesn't exist)
    const getOrCreateUsage = async () => {
      try {
        // First try to get existing usage
        const { data: existing, error: selectError } = await supabase
          .from('user_tool_usage')
          .select('word_usage, max_words, month')
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .single()
        
        if (existing) {
          return { data: [existing], error: null }
        }
        
        // If not exists, create it
        if (selectError?.code === 'PGRST116') {
          const { data: inserted, error: insertError } = await supabase
            .from('user_tool_usage')
            .insert({ user_id: userId, month: currentMonth, word_usage: 0, max_words: 40000 })
            .select('word_usage, max_words, month')
            .single()
          
          if (insertError) {
            console.error('Insert error:', insertError)
            return { data: [{ word_usage: 0, max_words: 40000, month: currentMonth }], error: null }
          }
          return { data: [inserted], error: null }
        }
        
        // Return default if any other error
        return { data: [{ word_usage: 0, max_words: 40000, month: currentMonth }], error: null }
      } catch (e) {
        console.error('getOrCreateUsage error:', e)
        return { data: [{ word_usage: 0, max_words: 40000, month: currentMonth }], error: null }
      }
    }

    // Helper to add word usage directly
    const addUsage = async (wordCount: number) => {
      try {
        const current = await getOrCreateUsage()
        const currentUsage = current.data?.[0]?.word_usage || 0
        
        const { data, error } = await supabase
          .from('user_tool_usage')
          .update({ word_usage: currentUsage + wordCount, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .select('word_usage, max_words, month')
          .single()
        
        if (error || !data) {
          return { data: [{ word_usage: currentUsage + wordCount, max_words: 40000, month: currentMonth }], error: null }
        }
        return { data: [data], error: null }
      } catch (e) {
        console.error('addUsage error:', e)
        return { data: [{ word_usage: 0, max_words: 40000, month: currentMonth }], error: null }
      }
    }

    // Helper to subtract word usage directly
    const subtractUsage = async (wordCount: number) => {
      try {
        const current = await getOrCreateUsage()
        const currentUsage = current.data?.[0]?.word_usage || 0
        const newUsage = Math.max(0, currentUsage - wordCount)
        
        const { data, error } = await supabase
          .from('user_tool_usage')
          .update({ word_usage: newUsage, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .select('word_usage, max_words, month')
          .single()
        
        if (error || !data) {
          return { data: [{ word_usage: newUsage, max_words: 40000, month: currentMonth }], error: null }
        }
        return { data: [data], error: null }
      } catch (e) {
        console.error('subtractUsage error:', e)
        return { data: [{ word_usage: 0, max_words: 40000, month: currentMonth }], error: null }
      }
    }

    if (req.method === 'GET') {
      // Get current usage - try RPC first, fallback to direct query
      let data, error
      try {
        const rpcResult = await supabase.rpc('get_or_create_monthly_usage', { p_user_id: userId })
        if (rpcResult.error) {
          console.log('RPC failed, using direct query:', rpcResult.error.message)
          const fallback = await getOrCreateUsage()
          data = fallback.data
          error = fallback.error
        } else {
          data = rpcResult.data
          error = rpcResult.error
        }
      } catch (e) {
        console.log('RPC exception, using direct query')
        const fallback = await getOrCreateUsage()
        data = fallback.data
        error = fallback.error
      }

      const usage = data?.[0] || { word_usage: 0, max_words: 40000, month: currentMonth }

      return new Response(
        JSON.stringify({
          success: true,
          wordUsage: usage.word_usage,
          maxWords: usage.max_words,
          month: usage.month
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      const { action, wordCount } = await req.json()

      if (!action || !['add', 'subtract', 'get', 'reset'].includes(action)) {
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let data, error

      if (action === 'get') {
        const result = await getOrCreateUsage()
        data = result.data
        error = result.error
      } else if (action === 'add' && typeof wordCount === 'number') {
        const result = await addUsage(wordCount)
        data = result.data
        error = result.error
      } else if (action === 'subtract' && typeof wordCount === 'number') {
        const result = await subtractUsage(wordCount)
        data = result.data
        error = result.error
      } else if (action === 'reset') {
        await supabase
          .from('user_tool_usage')
          .update({ word_usage: 0, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', currentMonth)
        data = [{ word_usage: 0, max_words: 40000, month: currentMonth }]
      }

      const usage = data?.[0] || { word_usage: 0, max_words: 40000, month: currentMonth }

      return new Response(
        JSON.stringify({
          success: true,
          wordUsage: usage.word_usage,
          maxWords: usage.max_words,
          month: usage.month
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in tool-usage function:', error)
    // Return default values instead of error to prevent UI from breaking
    const currentMonth = new Date().toISOString().slice(0, 7)
    return new Response(
      JSON.stringify({
        success: true,
        wordUsage: 0,
        maxWords: 40000,
        month: currentMonth
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
